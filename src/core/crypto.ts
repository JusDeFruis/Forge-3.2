import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const KDF_ITERATIONS = 600_000;

const FERNET_MAGIC = 0x80;
const BLOCK = 16;

export class CryptoError extends Error {}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(text: string): Buffer {
  const norm = text.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(norm, 'base64');
}

export function tokenUrlSafe(bytes: number): string {
  return b64url(randomBytes(bytes));
}

export function deriveFernetKey(passphrase: string, salt: Buffer): string {
  const derived = pbkdf2Sync(Buffer.from(passphrase, 'utf8'), salt, KDF_ITERATIONS, 32, 'sha256');
  return b64url(derived);
}

function splitKey(keyB64: string): { signKey: Buffer; encKey: Buffer } {
  const key = fromB64url(keyB64);
  if (key.length !== 32) throw new CryptoError('fernet key must be 32 bytes');
  return { signKey: key.subarray(0, 16), encKey: key.subarray(16, 32) };
}

export function fernetEncrypt(plaintext: Buffer, keyB64: string): string {
  const { signKey, encKey } = splitKey(keyB64);
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-128-cbc', encKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const timestamp = Buffer.alloc(8);
  timestamp.writeUInt32BE(Math.floor(Date.now() / 1000), 4);
  const head = Buffer.concat([Buffer.from([FERNET_MAGIC]), timestamp, iv, ciphertext]);
  const mac = createHmac('sha256', signKey).update(head).digest();
  return b64url(Buffer.concat([head, mac]));
}

export function fernetDecrypt(token: string, keyB64: string): Buffer {
  const { signKey, encKey } = splitKey(keyB64);
  const blob = fromB64url(token.trim());
  if (blob.length < 1 + 8 + 16 + BLOCK + 32) throw new CryptoError('invalid token');
  if (blob[0] !== FERNET_MAGIC) throw new CryptoError('invalid token version');
  const head = blob.subarray(0, blob.length - 32);
  const mac = blob.subarray(blob.length - 32);
  const expected = createHmac('sha256', signKey).update(head).digest();
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) {
    throw new CryptoError('invalid token');
  }
  const iv = head.subarray(9, 25);
  const ciphertext = head.subarray(25);
  const decipher = createDecipheriv('aes-128-cbc', encKey, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function sealSecrets(secrets: Record<string, string>, passphrase: string): string {
  if (!passphrase) throw new CryptoError('refusing to seal with an empty passphrase');
  const salt = randomBytes(16);
  const key = deriveFernetKey(passphrase, salt);
  const payload = Buffer.from(JSON.stringify(secrets), 'utf8');
  const token = fernetEncrypt(payload, key);
  return ['FORGE3-VAULT-1', salt.toString('base64'), token].join('\n');
}

export function unsealSecrets(blob: string, passphrase: string): Record<string, string> {
  const lines = blob.trim().split(/\r?\n/);
  if (lines.length < 3) throw new CryptoError('vault blob is malformed');
  const [magic, b64salt, token] = lines;
  if (magic.trim() !== 'FORGE3-VAULT-1') throw new CryptoError('not an FORGE 3.0 vault (bad magic)');
  const key = deriveFernetKey(passphrase, Buffer.from(b64salt, 'base64'));
  let plain: Buffer;
  try {
    plain = fernetDecrypt(token, key);
  } catch {
    throw new CryptoError('wrong passphrase or corrupt vault');
  }
  try {
    const parsed = JSON.parse(plain.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad shape');
    return parsed as Record<string, string>;
  } catch {
    throw new CryptoError('vault payload is corrupt');
  }
}
