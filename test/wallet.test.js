/* eslint-disable max-len */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sinon from 'sinon';

import { Amount } from '@coinspace/cs-common';
import { fromHex } from '@mysten/sui/utils';
import Wallet, { SUITransaction } from '@coinspace/cs-sui-wallet';

async function loadFixtires() {
  const fixtures = {};
  const files = await fs.readdir('./test/fixtures');
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join('./test/fixtures', file);
      fixtures[file.replace('.json', '')] = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    }
  }
  return fixtures;
}

// either dismiss upset disease clump hazard paddle twist fetch tissue hello buyer
const SEED = fromHex('3e818cec5efc7505369fae3f162af61130b673fa9b40e5955d5cde22a85afa03748d074356a281a5fc1dbd0b721357c56095a54de8d4bc6ecaa288f300776ae4');
const PRIVATE_KEY = 'suiprivkey1qzhq2ev9ly6gd9tkq4kkd63wygy9jsq4864hwpd7me3wyvfnx2naw87qevg';
const PUBLIC_KEY = {
  data: '5062dfe5df8e95cc8368a01771306833a8e774f4d31a0716fb381718451979aa',
  settings: {
    bip44: "m/44'/784'/0'/0'/0'",
  },
};
const ADDRESS = '0x0e6a8dcaee3fc4769c650bc914b0a2b35e60ba1f06839a6f7b308feaafa3e509';
const SECOND_ADDRESS = '0xcc2bd176a478baea9a0de7a24cd927661cc6e860d5bacecb9a138ef20dbab231';
const SUI_PRICE = 4.19;

const FIXTURES = await loadFixtires();

const sui = {
  _id: 'sui@sui',
  asset: 'sui',
  platform: 'sui',
  type: 'coin',
  decimals: 9,
};
const usdcAtSui = {
  _id: 'usd-coin@sui',
  asset: 'usd-coin',
  platform: 'sui',
  type: 'token',
  address: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
  decimals: 6,
};
let defaultOptionsCoin;
let defaultOptionsToken;

describe('SUI Wallet', () => {
  beforeEach(() => {
    defaultOptionsCoin = {
      crypto: sui,
      platform: sui,
      cache: { get() {}, set() {} },
      settings: {},
      request(...args) { console.log(args); },
      apiNode: 'node',
      storage: { get() {}, set() {}, save() {} },
    };

    defaultOptionsToken = {
      crypto: usdcAtSui,
      platform: sui,
      cache: { get() {}, set() {} },
      settings: {},
      request(...args) { console.log(args); },
      apiNode: 'node',
      storage: { get() {}, set() {}, save() {} },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('create wallet instance (coin)', () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      assert.equal(wallet.state, Wallet.STATE_CREATED);
    });

    it('create wallet instance (token)', () => {
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      assert.equal(wallet.state, Wallet.STATE_CREATED);
      assert.equal(wallet.tokenUrl, 'https://suiscan.xyz/mainnet/coin/0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC');
    });

    it('wallet should have tokenUrl static method', () => {
      const url = Wallet.tokenUrl('sui', '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC', false);
      assert.equal(url, 'https://suiscan.xyz/mainnet/coin/0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC');
    });
  });

  describe('create wallet', () => {
    it('should create new wallet with seed (coin)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(SEED);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, ADDRESS);
    });

    it('should create new wallet with seed (token)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.create(SEED);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, ADDRESS);
    });

    it('should fails without seed', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await assert.rejects(async () => {
        await wallet.create();
      }, {
        name: 'TypeError',
        message: 'seed must be an instance of Uint8Array or Buffer, undefined provided',
      });
    });
  });

  describe('open wallet', () => {
    it('should open wallet with public key (coin)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(PUBLIC_KEY);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, ADDRESS);
    });

    it('should open wallet with public key (token)', async () => {
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(PUBLIC_KEY);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, ADDRESS);
    });

    it('should fails without public key', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await assert.rejects(async () => {
        await wallet.open();
      }, {
        name: 'TypeError',
        message: 'publicKey must be an instance of Object with data property',
      });
    });
  });

  describe('storage', () => {
    it('should load initial balance from storage (coin)', async () => {
      sinon.stub(defaultOptionsCoin.storage, 'get')
        .withArgs('balance').returns('1234567890');
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(PUBLIC_KEY);
      assert.equal(wallet.balance.value, 1234567890n);
    });

    it('should load initial balance from storage (token)', async () => {
      sinon.stub(defaultOptionsToken.storage, 'get')
        .withArgs('balance').returns('1234567890');
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(PUBLIC_KEY);
      assert.equal(wallet.balance.value, 1234567890n);
    });
  });

  describe('load', () => {
    it('should load wallet (coin)', async () => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins']);
      const storage = sinon.mock(defaultOptionsCoin.storage);
      storage.expects('set').once().withArgs('balance', '4936421995');
      storage.expects('save').once();
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();
      assert.equal(wallet.state, Wallet.STATE_LOADED);
      assert.equal(wallet.balance.value, 4936421995n);
      storage.verify();
    });

    it('should load wallet (token)', async () => {
      sinon.stub(defaultOptionsToken, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/${usdcAtSui.address}/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['tokens']);
      const storage = sinon.mock(defaultOptionsToken.storage);
      storage.expects('set').once().withArgs('balance', '700000000');
      storage.expects('save').once();
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();
      assert.equal(wallet.state, Wallet.STATE_LOADED);
      assert.equal(wallet.balance.value, 700000000n);
      storage.verify();
    });

    it('should set STATE_ERROR on error', async () => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
        }).rejects();
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(PUBLIC_KEY);
      await assert.rejects(async () => {
        await wallet.load();
      });
      assert.equal(wallet.state, Wallet.STATE_ERROR);
    });
  });

  describe('getPublicKey', () => {
    it('should export public key', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(SEED);
      const publicKey = wallet.getPublicKey();
      assert.deepEqual(publicKey, PUBLIC_KEY);
    });

    it('public key is valid', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(SEED);
      const publicKey = wallet.getPublicKey();
      const secondWalet = new Wallet({
        ...defaultOptionsCoin,
      });
      secondWalet.open(publicKey);
      assert.equal(wallet.address, secondWalet.address);
    });
  });

  describe('getPrivateKey', () => {
    it('should export private key', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.create(SEED);
      const privateKey = wallet.getPrivateKey(SEED);
      assert.deepEqual(privateKey, [{
        address: ADDRESS,
        privatekey: PRIVATE_KEY,
      }]);
    });
  });

  describe('validators', () => {
    describe('validateAddress', () => {
      let wallet;
      beforeEach(async () => {
        sinon.stub(defaultOptionsCoin, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['coins']);
        wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(PUBLIC_KEY);
        await wallet.load();
      });

      it('valid address', async () => {
        assert.ok(await wallet.validateAddress({ address: SECOND_ADDRESS }));
      });

      it('invalid address', async () => {
        await assert.rejects(async () => {
          await wallet.validateAddress({ address: '123' });
        }, {
          name: 'InvalidAddressError',
          message: 'Invalid address "123"',
        });
      });

      it('own address', async () => {
        await assert.rejects(async () => {
          await wallet.validateAddress({ address: ADDRESS });
        }, {
          name: 'DestinationEqualsSourceError',
          message: 'Destination address equals source address',
        });
      });
    });

    describe('validateAmount (coin)', () => {
      it('should be valid amount', async () => {
        sinon.stub(defaultOptionsCoin, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['coins'])
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/gasPrice',
            baseURL: 'node',
            headers: sinon.match.any,
          }).resolves({ price: 1000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v4/csfee',
            params: { crypto: 'sui@sui' },
          }).resolves(FIXTURES['csfee'])
          .withArgs({
            seed: 'device',
            method: 'POST',
            url: 'api/v1/transaction/dryRun',
            baseURL: 'node',
            headers: sinon.match.any,
            data: {
              transaction: sinon.match.string,
            },
          }).resolves(FIXTURES['estimate-coin']);
        const wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(PUBLIC_KEY);
        await wallet.load();

        const valid = await wallet.validateAmount({
          address: SECOND_ADDRESS,
          amount: new Amount(1_000000000n, wallet.crypto.decimals),
          price: SUI_PRICE,
        });
        assert.ok(valid);
      });

      it('throw on small amount', async () => {
        sinon.stub(defaultOptionsCoin, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['coins'])
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/gasPrice',
            baseURL: 'node',
            headers: sinon.match.any,
          }).resolves({ price: 1000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v4/csfee',
            params: { crypto: 'sui@sui' },
          }).resolves(FIXTURES['csfee'])
          .withArgs({
            seed: 'device',
            method: 'POST',
            url: 'api/v1/transaction/dryRun',
            baseURL: 'node',
            headers: sinon.match.any,
            data: {
              transaction: sinon.match.string,
            },
          }).resolves(FIXTURES['estimate-coin']);
        const wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(PUBLIC_KEY);
        await wallet.load();

        await assert.rejects(async () => {
          await wallet.validateAmount({
            address: SECOND_ADDRESS,
            amount: new Amount(0n, wallet.crypto.decimals),
            price: SUI_PRICE,
          });
        }, {
          name: 'SmallAmountError',
          message: 'Small amount',
          amount: new Amount(1n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount', async () => {
        sinon.stub(defaultOptionsCoin, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['coins'])
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/gasPrice',
            baseURL: 'node',
            headers: sinon.match.any,
          }).resolves({ price: 1000 })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v4/csfee',
            params: { crypto: 'sui@sui' },
          }).resolves(FIXTURES['csfee'])
          .withArgs({
            seed: 'device',
            method: 'POST',
            url: 'api/v1/transaction/dryRun',
            baseURL: 'node',
            headers: sinon.match.any,
            data: {
              transaction: sinon.match.string,
            },
          }).resolves(FIXTURES['estimate-coin']);
        const wallet = new Wallet({
          ...defaultOptionsCoin,
        });
        await wallet.open(PUBLIC_KEY);
        await wallet.load();

        await assert.rejects(async () => {
          await wallet.validateAmount({
            address: SECOND_ADDRESS,
            amount: new Amount(200_000000000n, wallet.crypto.decimals),
            price: SUI_PRICE,
          });
        }, {
          name: 'BigAmountError',
          message: 'Big amount',
          amount: new Amount(4859858950n, wallet.crypto.decimals),
        });
      });
    });

    describe('validateAmount (token)', () => {
      it('should be valid amount', async () => {
        sinon.stub(defaultOptionsToken, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['coins'])
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/${usdcAtSui.address}/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['tokens'])
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/gasPrice',
            baseURL: 'node',
            headers: sinon.match.any,
          }).resolves({ price: 1000 })
          .withArgs({
            seed: 'device',
            method: 'POST',
            url: 'api/v1/transaction/dryRun',
            baseURL: 'node',
            headers: sinon.match.any,
            data: {
              transaction: sinon.match.string,
            },
          }).resolves(FIXTURES['estimate-token']);
        const wallet = new Wallet({
          ...defaultOptionsToken,
        });
        await wallet.open(PUBLIC_KEY);
        await wallet.load();

        const valid = await wallet.validateAmount({
          address: SECOND_ADDRESS,
          amount: new Amount(1_00000000n, wallet.crypto.decimals),
        });
        assert.ok(valid);
      });

      it('throw insufficient coin', async () => {
        sinon.stub(defaultOptionsToken, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves({ data: [] })
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/${usdcAtSui.address}/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['tokens'])
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/gasPrice',
            baseURL: 'node',
            headers: sinon.match.any,
          }).resolves({ price: 1000 })
          .withArgs({
            seed: 'device',
            method: 'POST',
            url: 'api/v1/transaction/dryRun',
            baseURL: 'node',
            headers: sinon.match.any,
            data: {
              transaction: sinon.match.string,
            },
          }).resolves(FIXTURES['estimate-token']);
        const wallet = new Wallet({
          ...defaultOptionsToken,
        });
        await wallet.open(PUBLIC_KEY);
        await wallet.load();

        await assert.rejects(async () => {
          await wallet.validateAmount({
            address: SECOND_ADDRESS,
            amount: new Amount(123n, wallet.crypto.decimals),
            price: SUI_PRICE,
          });
        }, {
          name: 'InsufficientCoinForTransactionFeeError',
          message: 'Insufficient funds to pay the transaction fee',
          amount: new Amount(4323624n, wallet.platform.decimals),
        });
      });

      it('throw on small amount', async () => {
        sinon.stub(defaultOptionsToken, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['coins'])
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/${usdcAtSui.address}/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['tokens'])
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/gasPrice',
            baseURL: 'node',
            headers: sinon.match.any,
          }).resolves({ price: 1000 })
          .withArgs({
            seed: 'device',
            method: 'POST',
            url: 'api/v1/transaction/dryRun',
            baseURL: 'node',
            headers: sinon.match.any,
            data: {
              transaction: sinon.match.string,
            },
          }).resolves(FIXTURES['estimate-token']);
        const wallet = new Wallet({
          ...defaultOptionsToken,
        });
        await wallet.open(PUBLIC_KEY);
        await wallet.load();

        await assert.rejects(async () => {
          await wallet.validateAmount({
            address: SECOND_ADDRESS,
            amount: new Amount(0n, wallet.crypto.decimals),
            price: SUI_PRICE,
          });
        }, {
          name: 'SmallAmountError',
          message: 'Small amount',
          amount: new Amount(1n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount', async () => {
        sinon.stub(defaultOptionsToken, 'request')
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['coins'])
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: `api/v1/token/${usdcAtSui.address}/${ADDRESS}/objects`,
            baseURL: 'node',
            headers: sinon.match.any,
            params: sinon.match.any,
          }).resolves(FIXTURES['tokens'])
          .withArgs({
            seed: 'device',
            method: 'GET',
            url: 'api/v1/gasPrice',
            baseURL: 'node',
            headers: sinon.match.any,
          }).resolves({ price: 1000 })
          .withArgs({
            seed: 'device',
            method: 'POST',
            url: 'api/v1/transaction/dryRun',
            baseURL: 'node',
            headers: sinon.match.any,
            data: {
              transaction: sinon.match.string,
            },
          }).resolves(FIXTURES['estimate-token']);
        const wallet = new Wallet({
          ...defaultOptionsToken,
        });
        await wallet.open(PUBLIC_KEY);
        await wallet.load();

        await assert.rejects(async () => {
          await wallet.validateAmount({
            address: SECOND_ADDRESS,
            amount: new Amount(200_00000000n, wallet.crypto.decimals),
            price: SUI_PRICE,
          });
        }, {
          name: 'BigAmountError',
          message: 'Big amount',
          amount: new Amount(7_00000000n, wallet.crypto.decimals),
        });
      });
    });

    describe('validateDerivationPath', () => {
      let wallet;
      beforeEach(async () => {
        wallet = new Wallet({
          ...defaultOptionsCoin,
        });
      });

      it('valid path', () => {
        assert.equal(wallet.validateDerivationPath("m/44'/784'/1'/2'/3'"), true);
      });

      it('invalid path', () => {
        assert.equal(wallet.validateDerivationPath("m/44'/784'/0'/0/0'"), false);
      });
    });
  });

  describe('estimateTransactionFee', () => {
    it('should estimate transaction fee (coin)', async () => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/gasPrice',
          baseURL: 'node',
          headers: sinon.match.any,
        }).resolves({ price: 1000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v4/csfee',
          params: { crypto: 'sui@sui' },
        }).resolves(FIXTURES['csfee'])
        .withArgs({
          seed: 'device',
          method: 'POST',
          url: 'api/v1/transaction/dryRun',
          baseURL: 'node',
          headers: sinon.match.any,
          data: {
            transaction: sinon.match.string,
          },
        }).resolves(FIXTURES['estimate-coin']);
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();
      const fee = await wallet.estimateTransactionFee({
        address: SECOND_ADDRESS,
        amount: new Amount(1n, wallet.crypto.decimals),
        price: SUI_PRICE,
      });
      assert.equal(fee.value, 76563045n);
    });

    it('should estimate transaction fee (token)', async () => {
      sinon.stub(defaultOptionsToken, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/${usdcAtSui.address}/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['tokens'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/gasPrice',
          baseURL: 'node',
          headers: sinon.match.any,
        }).resolves({ price: 1000 })
        .withArgs({
          seed: 'device',
          method: 'POST',
          url: 'api/v1/transaction/dryRun',
          baseURL: 'node',
          headers: sinon.match.any,
          data: {
            transaction: sinon.match.string,
          },
        }).resolves(FIXTURES['estimate-token']);
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();
      const fee = await wallet.estimateTransactionFee({
        address: SECOND_ADDRESS,
        amount: new Amount(1n, wallet.crypto.decimals),
      });
      assert.equal(fee.value, 4323624n);
    });
  });

  describe('estimateMaxAmount', () => {
    it('should correct estimate max amount (coin)', async () => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/gasPrice',
          baseURL: 'node',
          headers: sinon.match.any,
        }).resolves({ price: 1000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v4/csfee',
          params: { crypto: 'sui@sui' },
        }).resolves(FIXTURES['csfee'])
        .withArgs({
          seed: 'device',
          method: 'POST',
          url: 'api/v1/transaction/dryRun',
          baseURL: 'node',
          headers: sinon.match.any,
          data: {
            transaction: sinon.match.string,
          },
        }).resolves(FIXTURES['estimate-coin']);
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();
      const maxAmount = await wallet.estimateMaxAmount({ address: SECOND_ADDRESS, price: SUI_PRICE });
      assert.equal(maxAmount.value, 4859858950n);
    });

    it('should correct estimate max amount (coin many objects)', async () => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves({ data: Array(500).fill(FIXTURES['coins'].data[0]) })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/gasPrice',
          baseURL: 'node',
          headers: sinon.match.any,
        }).resolves({ price: 1000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v4/csfee',
          params: { crypto: 'sui@sui' },
        }).resolves(FIXTURES['csfee'])
        .withArgs({
          seed: 'device',
          method: 'POST',
          url: 'api/v1/transaction/dryRun',
          baseURL: 'node',
          headers: sinon.match.any,
          data: {
            transaction: sinon.match.string,
          },
        }).resolves(FIXTURES['estimate-coin']);
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();
      const maxAmount = await wallet.estimateMaxAmount({ address: SECOND_ADDRESS, price: SUI_PRICE });
      assert.equal(maxAmount.value, 24870682588n);
    });

    it('should correct estimate max amount (token)', async () => {
      sinon.stub(defaultOptionsToken, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/${usdcAtSui.address}/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['tokens']);
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();
      const maxAmount = await wallet.estimateMaxAmount({ address: SECOND_ADDRESS });
      assert.equal(maxAmount.value, 700000000n);
    });

    it('should correct estimate max amount (token many object)', async () => {
      sinon.stub(defaultOptionsToken, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/${usdcAtSui.address}/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves({ data: Array(500).fill(FIXTURES['tokens'].data[0]) });
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();
      const maxAmount = await wallet.estimateMaxAmount({ address: SECOND_ADDRESS });
      assert.equal(maxAmount.value, 25000000000n);
    });
  });

  describe('createTransaction', () => {
    it('should create valid transaction (coin)', async () => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/gasPrice',
          baseURL: 'node',
          headers: sinon.match.any,
        }).resolves({ price: 1000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v4/csfee',
          params: { crypto: 'sui@sui' },
        }).resolves(FIXTURES['csfee'])
        .withArgs({
          seed: 'device',
          method: 'POST',
          url: 'api/v1/transaction/dryRun',
          baseURL: 'node',
          headers: sinon.match.any,
          data: {
            transaction: sinon.match.string,
          },
        }).resolves(FIXTURES['estimate-coin'])
        .withArgs({
          seed: 'device',
          method: 'POST',
          url: 'api/v1/transaction/send',
          baseURL: 'node',
          headers: sinon.match.any,
          data: {
            transaction: sinon.match.string,
            signature: sinon.match.string,
          },
        }).resolves(FIXTURES['transaction-coin']);
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();

      assert.equal(wallet.balance.value, 4_936421995n);
      await wallet.createTransaction({
        address: SECOND_ADDRESS,
        amount: new Amount(1_000000000, wallet.crypto.decimals),
        price: SUI_PRICE,
      }, SEED);
      assert.equal(wallet.balance.value, 3_871195451n);
    });

    it('should create valid transaction (token)', async () => {
      sinon.stub(defaultOptionsToken, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/${usdcAtSui.address}/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['tokens'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/gasPrice',
          baseURL: 'node',
          headers: sinon.match.any,
        }).resolves({ price: 1000 })
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v4/csfee',
          params: { crypto: 'sui@sui' },
        }).resolves(FIXTURES['csfee'])
        .withArgs({
          seed: 'device',
          method: 'POST',
          url: 'api/v1/transaction/dryRun',
          baseURL: 'node',
          headers: sinon.match.any,
          data: {
            transaction: sinon.match.string,
          },
        }).resolves(FIXTURES['estimate-token'])
        .withArgs({
          seed: 'device',
          method: 'POST',
          url: 'api/v1/transaction/send',
          baseURL: 'node',
          headers: sinon.match.any,
          data: {
            transaction: sinon.match.string,
            signature: sinon.match.string,
          },
        }).resolves(FIXTURES['transaction-token']);
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();

      await wallet.createTransaction({
        address: SECOND_ADDRESS,
        amount: new Amount(1_00000000, wallet.crypto.decimals),
      }, SEED);
      assert.equal(wallet.balance.value, 6_00000000n);
    });
  });

  describe('loadTransactions', () => {
    it('should load transactions (coin)', async () => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/address/${ADDRESS}/transactions`,
          params: {
            cursor: undefined,
            limit: 10,
          },
          baseURL: 'node',
          headers: sinon.match.any,
        }).resolves(FIXTURES['transactions']);
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();

      const res = await wallet.loadTransactions();
      assert.equal(res.transactions.length, 3);
      assert.equal(res.transactions[0].incoming, false);
      assert.equal(res.transactions[0].action, SUITransaction.ACTION_TOKEN_TRANSFER);
      assert.deepEqual(res.transactions[0].amount, new Amount(0n, sui.decimals));
      assert.deepEqual(res.transactions[0].fee, new Amount(2345504n, sui.decimals));
      assert.equal(res.transactions[1].incoming, false);
      assert.equal(res.transactions[1].action, SUITransaction.ACTION_TRANSFER);
      assert.deepEqual(res.transactions[1].amount, new Amount(500000000n, sui.decimals));
      assert.deepEqual(res.transactions[1].fee, new Amount(2985880n + 62240664n, sui.decimals));
      assert.equal(res.transactions[2].incoming, true);
      assert.equal(res.transactions[2].action, SUITransaction.ACTION_TRANSFER);
      assert.deepEqual(res.transactions[2].amount, new Amount(1000000000n, sui.decimals));
      assert.deepEqual(res.transactions[2].fee, new Amount(47445880n, sui.decimals));
      assert.equal(res.hasMore, false);
      assert.equal(res.cursor, 'eyJjIjoxNTAzNDU4NjQsInQiOjE4NTg3NDA1NzIsImkiOmZhbHNlfQ');
    });

    it('should load transactions (token)', async () => {
      sinon.stub(defaultOptionsToken, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/0x2::sui::SUI/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['coins'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/token/${usdcAtSui.address}/${ADDRESS}/objects`,
          baseURL: 'node',
          headers: sinon.match.any,
          params: sinon.match.any,
        }).resolves(FIXTURES['tokens'])
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: `api/v1/address/${ADDRESS}/transactions`,
          params: {
            cursor: undefined,
            limit: 10,
          },
          baseURL: 'node',
          headers: sinon.match.any,
        }).resolves(FIXTURES['transactions']);
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });
      await wallet.open(PUBLIC_KEY);
      await wallet.load();

      const res = await wallet.loadTransactions();
      assert.equal(res.transactions.length, 2);
      assert.equal(res.transactions[0].incoming, false);
      assert.equal(res.transactions[0].action, SUITransaction.ACTION_TRANSFER);
      assert.deepEqual(res.transactions[0].amount, new Amount(1000000n, usdcAtSui.decimals));
      assert.deepEqual(res.transactions[0].fee, new Amount(2345504n, sui.decimals));
      assert.equal(res.transactions[1].incoming, true);
      assert.equal(res.transactions[1].action, SUITransaction.ACTION_TRANSFER);
      assert.deepEqual(res.transactions[1].amount, new Amount(10000000n, usdcAtSui.decimals));
      assert.deepEqual(res.transactions[1].fee, new Amount(2445504n, sui.decimals));
      assert.equal(res.hasMore, false);
      assert.equal(res.cursor, 'eyJjIjoxNTAzNDU4NjQsInQiOjE4NTg3NDA1NzIsImkiOmZhbHNlfQ');
    });
  });

  describe('unalias', () => {
    let wallet;

    beforeEach(() => {
      sinon.stub(defaultOptionsCoin, 'request')
        .withArgs({
          seed: 'device',
          method: 'GET',
          url: 'api/v1/unalias',
          baseURL: 'node',
          headers: sinon.match.any,
          params: {
            alias: 'example.sui',
          },
        }).resolves(FIXTURES['unalias']);
      wallet = new Wallet({
        ...defaultOptionsCoin,
      });
    });

    it('unalias walid name', async () => {
      assert.deepEqual(await wallet.unalias('example.sui'), {
        alias: 'example.sui',
        address: '0xfe09cf0b3d77678b99250572624bf74fe3b12af915c5db95f0ed5d755612eb68',
      });
    });

    it('unalias invalid name', async () => {
      assert.deepEqual(await wallet.unalias('foobar'), undefined);
    });
  });

  describe('settings', () => {
    it('settings supported for coin', async () => {
      const wallet = new Wallet({
        ...defaultOptionsCoin,
      });

      assert.equal(wallet.isSettingsSupported, true);
    });

    it('settings not supported for token', async () => {
      const wallet = new Wallet({
        ...defaultOptionsToken,
      });

      assert.equal(wallet.isSettingsSupported, false);
    });
  });
});
