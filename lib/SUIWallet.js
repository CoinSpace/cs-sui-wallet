import {
  Amount,
  Transaction as CsTransaction,
  CsWallet,
  errors,
} from '@coinspace/cs-common';
import {
  Ed25519Keypair,
  Ed25519PublicKey,
} from '@mysten/sui/keypairs/ed25519';
import {
  Inputs,
  Transaction,
} from '@mysten/sui/transactions';
import {
  fromHex,
  isValidSuiAddress,
  isValidSuiNSName,
  normalizeSuiAddress,
  toBase64,
  toHex,
} from '@mysten/sui/utils';

const GAS_SAFE_OVERHEAD = 1000n;
const MAX_GAS = 50_000_000_000n;
const SUI_ADDRESS = '0x2::sui::SUI';
const MAX_INPUT_OBJECTS = 250;

import API from './API.js';

export class SUITransaction extends CsTransaction {
  get url() {
    if (this.development) {
      return `https://suiscan.xyz/testnet/tx/${this.id}`;
    }
    return `https://suiscan.xyz/mainnet/tx/${this.id}`;
  }
}

export default class SUIWallet extends CsWallet {
  #api;
  #publicKey;
  #address;
  #sendableCoinObjects;
  #sendableTokenObjects;
  #coinBalance = 0n;
  #tokenBalance = 0n;
  #dustThreshold = 1n;

  get balance() {
    if (this.crypto.type === 'coin') {
      return new Amount(this.#coinBalance, this.crypto.decimals);
    }
    if (this.crypto.type === 'token') {
      return new Amount(this.#tokenBalance, this.crypto.decimals);
    }
    throw new errors.InternalWalletError('Unsupported crypto type');
  }

  get tokenUrl() {
    if (this.crypto.type === 'token') {
      if (this.development) {
        return `https://suiscan.xyz/testnet/coin/${this.crypto.address}`;
      }
      return `https://suiscan.xyz/mainnet/coin/${this.crypto.address}`;
    }
    return undefined;
  }

  get address() {
    return this.#address;
  }

  get defaultSettings() {
    return {
      bip44: "m/44'/784'/0'/0'/0'",
    };
  }

  get isSettingsSupported() {
    return this.crypto.type === 'coin';
  }

  get isCsFeeSupported() {
    return this.crypto.type === 'coin';
  }

  get isUnaliasSupported() {
    return true;
  }

  get dummyExchangeDepositAddress() {
    return '0xcc2bd176a478baea9a0de7a24cd927661cc6e860d5bacecb9a138ef20dbab231';
  }

  constructor(options = {}) {
    super(options);
    this.#api = new API(this);
  }

  async create(seed) {
    this.typeSeed(seed);
    this.state = CsWallet.STATE_INITIALIZING;
    this.#publicKey = Ed25519Keypair.deriveKeypairFromSeed(toHex(seed), this.settings.bip44).getPublicKey();
    this.#address = this.#publicKey.toSuiAddress();
    this.#init();
    this.state = CsWallet.STATE_INITIALIZED;
  }

  async open(publicKey) {
    this.typePublicKey(publicKey);
    this.state = CsWallet.STATE_INITIALIZING;
    if (publicKey.settings.bip44 === this.settings.bip44) {
      this.#publicKey = new Ed25519PublicKey(fromHex(publicKey.data));
      this.#address = this.#publicKey.toSuiAddress();
      this.#init();
      this.state = CsWallet.STATE_INITIALIZED;
    } else {
      this.state = CsWallet.STATE_NEED_INITIALIZATION;
    }
  }

  #init() {
    if (this.crypto.type === 'coin') {
      this.#coinBalance = BigInt(this.storage.get('balance') || 0);
    }
    if (this.crypto.type === 'token') {
      this.#tokenBalance = BigInt(this.storage.get('balance') || 0);
    }
  }

  async load() {
    this.state = CsWallet.STATE_LOADING;
    try {
      const coinObjects = await this.#api.getObjects();
      this.#coinBalance = coinObjects.reduce((sum, obj) => sum + BigInt(obj.balance), 0n);
      this.#sendableCoinObjects = coinObjects
        .toSorted((a, b) => parseInt(b.balance) - parseInt(a.balance))
        .slice(0, MAX_INPUT_OBJECTS);
      if (this.crypto.type === 'coin') {
        this.storage.set('balance', this.#coinBalance.toString());
      }
      if (this.crypto.type === 'token') {
        const tokenObjects = (await this.#api.getObjects(this.crypto.address));
        this.#tokenBalance = tokenObjects.reduce((sum, obj) => sum + BigInt(obj.balance), 0n);
        this.#sendableTokenObjects = tokenObjects
          .toSorted((a, b) => parseInt(b.balance) - parseInt(a.balance))
          .slice(0, MAX_INPUT_OBJECTS);
        this.storage.set('balance', this.#tokenBalance.toString());
      }
      await this.storage.save();
      this.state = CsWallet.STATE_LOADED;
    } catch (err) {
      this.state = CsWallet.STATE_ERROR;
      throw err;
    }
  }

  async cleanup() {
    await super.cleanup();
    this.#api.cleanup();
  }

  getPublicKey() {
    return {
      settings: this.settings,
      data: toHex(this.#publicKey.toRawBytes()),
    };
  }

  getPrivateKey(seed) {
    this.typeSeed(seed);
    return [{
      address: this.#address,
      privatekey: Ed25519Keypair.deriveKeypairFromSeed(toHex(seed), this.settings.bip44).getSecretKey(),
    }];
  }

  validateDerivationPath(path) {
    return /^m(\/\d+')*$/.test(path);
  }

  async validateAddress({ address }) {
    super.validateAddress({ address });
    if (!isValidSuiAddress(address)) {
      throw new errors.InvalidAddressError(address);
    }
    if (this.#address === normalizeSuiAddress(address)) {
      throw new errors.DestinationEqualsSourceError();
    }
    return true;
  }

  async validateAmount({ address, amount, price }) {
    super.validateAmount({ address, amount, price });
    const { value } = amount;
    if (value < this.#dustThreshold) {
      throw new errors.SmallAmountError(new Amount(this.#dustThreshold, this.crypto.decimals));
    }
    if (this.crypto.type === 'token') {
      const minerFee = await this.#estimateMinerFee({
        address,
        value,
      });
      if (minerFee > this.#coinBalance) {
        throw new errors.InsufficientCoinForTransactionFeeError(new Amount(minerFee, this.platform.decimals));
      }
    }
    const maxAmount = await this.#estimateMaxAmount({ address, price });
    if (value > maxAmount) {
      throw new errors.BigAmountError(new Amount(maxAmount, this.crypto.decimals));
    }
    return true;
  }

  async #createTransfer({ value, address, csFeeValue, csFeeAddress }) {
    const tx = new Transaction();
    tx.setSenderIfNotSet(this.address);

    if (this.crypto.type === 'coin') {
      if (csFeeValue > 0n) {
        const [transferObject, csfeeObject] = tx.splitCoins(tx.gas, [value, csFeeValue]);
        tx.transferObjects([transferObject], address);
        tx.transferObjects([csfeeObject], csFeeAddress);
      } else {
        const [transferObject] = tx.splitCoins(tx.gas, [value]);
        tx.transferObjects([transferObject], address);
      }
    } else {
      const [first, ...rest] = this.#sendableTokenObjects;
      if (rest.length > 0) {
        tx.mergeCoins(
          tx.object(Inputs.ObjectRef({
            objectId: first.coinObjectId,
            version: first.version,
            digest: first.digest,
          })),
          rest.map((coin) => {
            return tx.object(Inputs.ObjectRef({
              objectId: coin.coinObjectId,
              version: coin.version,
              digest: coin.digest,
            }));
          })
        );
      }
      const [transferObject] = tx.splitCoins(tx.object(Inputs.ObjectRef({
        objectId: first.coinObjectId,
        version: first.version,
        digest: first.digest,
      })), [value]);
      tx.transferObjects([transferObject], address);
    }

    tx.setGasPrice(await this.#api.getGasPrice());
    tx.setGasPayment(this.#sendableCoinObjects.map((coin) => {
      return {
        objectId: coin.coinObjectId,
        version: coin.version,
        digest: coin.digest,
      };
    }));
    return tx;
  }

  async #estimateMinerFee({ value, address, csFeeValue, csFeeAddress }) {
    const tx = await this.#createTransfer({ value, address, csFeeValue, csFeeAddress });
    tx.setGasBudget(MAX_GAS);
    tx.setGasPayment([]);
    const dryRunResult = await this.#api.dryRunTransaction(toBase64(await tx.build()));

    if (dryRunResult.effects.status.status !== 'success') {
      throw new errors.InternalWalletError(
        `Dry run failed, could not automatically determine a budget: ${dryRunResult.effects.status.error}`,
        { cause: dryRunResult }
      );
    }

    const safeOverhead = GAS_SAFE_OVERHEAD * BigInt(tx.getData().gasData.price || 1n);

    const baseComputationCostWithOverhead =
      BigInt(dryRunResult.effects.gasUsed.computationCost) + safeOverhead;

    const gasBudget =
      baseComputationCostWithOverhead +
      BigInt(dryRunResult.effects.gasUsed.storageCost) -
      BigInt(dryRunResult.effects.gasUsed.storageRebate);

    return gasBudget > baseComputationCostWithOverhead ? gasBudget : baseComputationCostWithOverhead;
  }

  calculateCsFee({ value, price }) {
    return super.calculateCsFee(value, {
      price,
      dustThreshold: this.#dustThreshold,
    });
  }

  calculateCsFeeForMaxAmount({ value, price }) {
    return super.calculateCsFeeForMaxAmount(value, {
      price,
      dustThreshold: this.#dustThreshold,
    });
  }

  async estimateTransactionFee({ address, amount, price }) {
    super.estimateTransactionFee({ address, amount, price });
    const { value } = amount;
    if (this.crypto.type === 'coin') {
      const csFeeConfig = await this.getCsFeeConfig();
      const csFeeValue = await this.calculateCsFee({ value, price });
      const minerFee = await this.#estimateMinerFee({
        address,
        value,
        csFeeValue,
        csFeeAddress: csFeeConfig.address,
      });
      if (this.development) console.log({ minerFee, csFee: csFeeValue });
      return new Amount(minerFee + csFeeValue, this.crypto.decimals);
    } else {
      const minerFee = await this.#estimateMinerFee({
        address,
        value,
      });
      return new Amount(minerFee, this.platform.decimals);
    }
  }

  async #estimateMaxAmount({ address, price }) {
    if (this.crypto.type === 'token') {
      if (this.#tokenBalance === 0n) {
        return 0n;
      }
      return this.#sendableTokenObjects.reduce((sum, obj) => sum + BigInt(obj.balance), 0n);
    }
    if (this.#coinBalance === 0n) {
      return 0n;
    }

    const csFeeConfig = await this.getCsFeeConfig();
    const minerFee = await this.#estimateMinerFee({
      address,
      value: 1n,
      csFeeValue: csFeeConfig.disabled ? 0n : 1n,
      csFeeAddress: csFeeConfig.disabled ? undefined : csFeeConfig.address,
    });
    const sendableBalance = this.#sendableCoinObjects.reduce((sum, obj) => sum + BigInt(obj.balance), 0n);
    if (sendableBalance < minerFee) {
      return 0n;
    }

    const csFee = await this.calculateCsFeeForMaxAmount({ value: sendableBalance - minerFee, price });
    const max = sendableBalance - minerFee - csFee;
    if (max < 0n) {
      return 0n;
    }
    return max;
  }

  async estimateMaxAmount({ address, price }) {
    super.estimateMaxAmount({ address, price });
    const maxAmount = await this.#estimateMaxAmount({ address, price });
    return new Amount(maxAmount, this.crypto.decimals);
  }

  async createTransaction({ address, amount, price }, seed) {
    super.createTransaction({ address, amount, price }, seed);
    const { value } = amount;
    const keypair = Ed25519Keypair.deriveKeypairFromSeed(toHex(seed), this.settings.bip44);
    if (this.crypto.type === 'coin') {
      const csFeeConfig = await this.getCsFeeConfig();
      const csFeeValue = await this.calculateCsFee({ value, price });
      const minerFee = await this.#estimateMinerFee({
        address,
        value,
        csFeeValue,
        csFeeAddress: csFeeConfig.address,
      });
      const tx = await this.#createTransfer({ value, address, csFeeValue, csFeeAddress: csFeeConfig.address });
      tx.setGasBudget(minerFee);
      const { signature, bytes } = await keypair.signTransaction(await tx.build());
      const executeResult = await this.#api.executeTransaction(bytes, signature);
      const balanceChange = executeResult.balanceChanges.find((item) => item.owner?.AddressOwner === this.#address);
      if (balanceChange) {
        this.#coinBalance += BigInt(balanceChange.amount);
      }
      if (this.#coinBalance < 0n) this.#coinBalance = 0n;
      this.storage.set('balance', this.#coinBalance.toString());
      await this.storage.save();
      return executeResult.digest;
    } else {
      const minerFee = await this.#estimateMinerFee({
        address,
        value,
      });
      const tx = await this.#createTransfer({ value, address });
      tx.setGasBudget(minerFee);
      const { signature, bytes } = await keypair.signTransaction(await tx.build());
      const executeResult = await this.#api.executeTransaction(bytes, signature);
      const totalFee = BigInt(executeResult.effects.gasUsed.computationCost) +
        BigInt(executeResult.effects.gasUsed.storageCost) -
        BigInt(executeResult.effects.gasUsed.storageRebate);
      this.#coinBalance -= totalFee;
      if (this.#coinBalance < 0n) this.#coinBalance = 0n;
      this.#tokenBalance -= value;
      this.storage.set('balance', this.#tokenBalance.toString());
      await this.storage.save();
      return executeResult.digest;
    }
  }

  async loadTransactions({ cursor } = {}) {
    const data = await this.#api.getTransactions(this.#address, cursor, this.txPerPage);
    const transactions = data.transactions
      .map((item) => this.#transformTx(item))
      .filter((item) => !!item)
      .toSorted((a, b) => b.timestamp - a.timestamp);
    return {
      transactions,
      hasMore: data.hasMore,
      cursor: data.cursor,
    };
  }

  #transformTx(tx) {
    try {
      const incoming = tx.sender !== this.#address;
      const status = tx.status === 'SUCCESS' ? SUITransaction.STATUS_SUCCESS : SUITransaction.STATUS_FAILED;
      const timestamp = new Date(parseInt(tx.timestamp));
      const TOKEN_ADDRESS = this.crypto.type === 'coin' ? SUI_ADDRESS : this.crypto.address;
      if (incoming) {
        const transfer = tx.balanceChanges.find((item) => {
          return item.coinType === TOKEN_ADDRESS && item.owner === this.#address;
        });
        if (!transfer) return;
        return new SUITransaction({
          id: tx.id,
          to: this.#address,
          from: tx.sender,
          amount: new Amount(parseInt(transfer.amount), this.crypto.decimals),
          incoming: true,
          fee: new Amount(tx.fee, this.platform.decimals),
          timestamp,
          confirmations: 1,
          minConfirmations: 1,
          status,
          development: this.development,
        });
      } else {
        if (this.crypto.type === 'coin') {
          // first outgoing transfer
          const transfer = tx.balanceChanges.find((item) => {
            return item.owner !== this.#address && item.csfee !== true;
          });
          if (!transfer) return;
          const csFee = BigInt(tx.balanceChanges.find((item) => {
            return item.csfee === true;
          })?.amount || 0);
          const isCoinTransaction = transfer.coinType === SUI_ADDRESS;
          return new SUITransaction({
            id: tx.id,
            to: transfer.owner,
            from: this.#address,
            amount: isCoinTransaction
              ? new Amount(parseInt(transfer.amount), this.crypto.decimals)
              : new Amount(0, this.crypto.decimals),
            incoming: false,
            fee: new Amount(BigInt(tx.fee) + csFee, this.platform.decimals),
            timestamp,
            confirmations: 1,
            minConfirmations: 1,
            status,
            development: this.development,
            action: isCoinTransaction
              ? SUITransaction.ACTION_TRANSFER
              : SUITransaction.ACTION_TOKEN_TRANSFER,
          });
        } else { // this.crypto.type === 'token'
          const transfer = tx.balanceChanges.find((item) => {
            return item.coinType === TOKEN_ADDRESS && item.owner !== this.#address;
          });
          if (!transfer) return;
          return new SUITransaction({
            id: tx.id,
            to: transfer.owner,
            from: this.#address,
            amount: new Amount(parseInt(transfer.amount), this.crypto.decimals),
            incoming: false,
            fee: new Amount(tx.fee, this.platform.decimals),
            timestamp,
            confirmations: 1,
            minConfirmations: 1,
            status,
            development: this.development,
          });
        }
      }
    } catch (err) {
      console.error(err, JSON.stringify(tx));
    }
  }

  async unalias(alias) {
    if (typeof alias !== 'string') return;
    if (!isValidSuiNSName(alias)) return;
    try {
      const { address } = await this.#api.unalias(alias);
      return {
        alias,
        address,
      };
      // eslint-disable-next-line no-empty
    } catch {}
  }
}
