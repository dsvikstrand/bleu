import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKeyFromBase64(rawKey: string) {
  const normalized = String(rawKey || '').trim();
  if (!normalized) {
    throw new Error('TOKEN_ENCRYPTION_NOT_CONFIGURED');
  }
  const key = Buffer.from(normalized, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY_INVALID');
  }
  return key;
}

export function encryptToken(plainText: string, rawKey: string) {
  const value = String(plainText || '');
  if (!value) return null;

  const key = getKeyFromBase64(rawKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
}

export function decryptToken(encryptedValue: string, rawKey: string) {
  const value = String(encryptedValue || '').trim();
  if (!value) return null;

  const segments = value.split(':');
  if (segments.length !== 4 || segments[0] !== 'v1') {
    throw new Error('TOKEN_ENCRYPTION_PAYLOAD_INVALID');
  }

  const [, ivBase64, encryptedBase64, tagBase64] = segments;
  const key = getKeyFromBase64(rawKey);
  const iv = Buffer.from(ivBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const tag = Buffer.from(tagBase64, 'base64');

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
