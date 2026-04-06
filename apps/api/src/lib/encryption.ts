import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from './env';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(config.ENCRYPTION_KEY, 'hex'); // 32 bytes

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decrypt(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [ivHex, tagHex, encryptedHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}
