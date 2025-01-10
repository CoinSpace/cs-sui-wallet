import { HDKey } from 'micro-key-producer/slip10.js';
import { ed25519 } from '@noble/curves/ed25519';

import {
  Keypair,
  PRIVATE_KEY_SIZE,
  PublicKey,
  SIGNATURE_SCHEME_TO_FLAG,
  decodeSuiPrivateKey,
  encodeSuiPrivateKey,
  isValidHardenedPath,
} from '@mysten/sui/cryptography';

const PUBLIC_KEY_SIZE = 32;

/**
 * An Ed25519 public key
 */
export class Ed25519PublicKey extends PublicKey {
  #data;

  constructor(value) {
    super();
    this.#data = value;
    if (this.#data.length !== PUBLIC_KEY_SIZE) {
      throw new Error(`Invalid public key input. Expected ${PUBLIC_KEY_SIZE} bytes, got ${this.#data.length}`);
    }
  }

  toRawBytes() {
    return this.#data;
  }

  flag() {
    return SIGNATURE_SCHEME_TO_FLAG['ED25519'];
  }
}

/**
 * An Ed25519 Keypair used for signing transactions.
 */
export class Ed25519Keypair extends Keypair {
  #keypair;

  constructor(keypair) {
    super();
    this.#keypair = keypair;
  }

  getKeyScheme() {
    return 'ED25519';
  }

  static fromSecretKey(secretKey, options) {
    if (typeof secretKey === 'string') {
      const decoded = decodeSuiPrivateKey(secretKey);
      if (decoded.schema !== 'ED25519') {
        throw new Error(`Expected a ED25519 keypair, got ${decoded.schema}`);
      }
      return this.fromSecretKey(decoded.secretKey, options);
    }
    if (secretKey.length !== PRIVATE_KEY_SIZE) {
      throw new Error(`Wrong secretKey size. Expected ${PRIVATE_KEY_SIZE} bytes, got ${secretKey.length}.`);
    }
    const keypair = {
      publicKey: ed25519.getPublicKey(secretKey),
      secretKey,
    };
    return new Ed25519Keypair(keypair);
  }

  getPublicKey() {
    return new Ed25519PublicKey(this.#keypair.publicKey);
  }

  getSecretKey() {
    return encodeSuiPrivateKey(this.#keypair.secretKey, this.getKeyScheme());
  }

  async sign(data) {
    return ed25519.sign(data, this.#keypair.secretKey);
  }

  static deriveKeypairFromSeed(seed, path) {
    if (!isValidHardenedPath(path)) {
      throw new Error('Invalid derivation path');
    }
    const { privateKey: secretKey, publicKeyRaw: publicKey } = HDKey
      .fromMasterSeed(seed)
      .derive(path);
    return new Ed25519Keypair({ secretKey, publicKey });
  }
}
