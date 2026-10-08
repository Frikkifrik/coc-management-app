import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { dataDir } from './database.mjs';

let cachedKey;

function encryptionKey() {
  if (cachedKey) return cachedKey;
  const configured = process.env.CLANCMD_APP_SECRET;
  if (configured && configured.length >= 32) {
    cachedKey = createHash('sha256').update(configured).digest();
    return cachedKey;
  }
  const keyPath = path.join(dataDir, '.webhook-key');
  if (existsSync(keyPath)) {
    cachedKey = readFileSync(keyPath);
  } else {
    cachedKey = randomBytes(32);
    writeFileSync(keyPath, cachedKey, { mode: 0o600, flag: 'wx' });
    chmodSync(keyPath, 0o600);
  }
  return cachedKey;
}

export function encryptSecret(value) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSecret(value) {
  if (!value) return null;
  const [ivText, tagText, encryptedText] = value.split('.');
  if (!ivText || !tagText || !encryptedText) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function isAllowedDiscordWebhook(value) {
  try {
    const url = new URL(value);
    const hostAllowed = url.hostname === 'discord.com' || url.hostname === 'discordapp.com';
    return url.protocol === 'https:' && hostAllowed && /^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}
