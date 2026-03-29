import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const SALT = Buffer.from('team-agents-channel-secrets-v1', 'utf8');

export interface IEncryptedPayload {
  algorithm: typeof ALGO;
  keyVersion: number;
  iv: string;
  ciphertext: string;
  authTag: string;
}

function deriveKey(masterKey: string, keyVersion: number): Buffer {
  const salt = Buffer.concat([SALT, Buffer.from(String(keyVersion), 'utf8')]);
  return scryptSync(masterKey, salt, KEY_LEN);
}

export function parseMasterKeyHex(hex: string): Buffer {
  const buf = Buffer.from(hex.trim(), 'hex');
  if (buf.length !== KEY_LEN) {
    throw new Error('ENCRYPTION_MASTER_KEY must be 64 hex chars (32 bytes)');
  }
  return buf;
}

/** Encrypt JSON-serializable object. Uses keyVersion 1 by default. */
export function encryptJson(masterKeyHex: string, value: unknown, keyVersion = 1): IEncryptedPayload {
  const key = deriveKey(masterKeyHex, keyVersion);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const plain = Buffer.from(JSON.stringify(value), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: ALGO,
    keyVersion,
    iv: iv.toString('base64'),
    ciphertext: enc.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptJson<T = unknown>(masterKeyHex: string, payload: IEncryptedPayload): T {
  const key = deriveKey(masterKeyHex, payload.keyVersion);
  const iv = Buffer.from(payload.iv, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(authTag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(dec.toString('utf8')) as T;
}
