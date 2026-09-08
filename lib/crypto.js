import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

// Standard scrypt options for secure key derivation
const SCRYPT_OPTIONS = {
  N: 16384, // CPU/memory cost
  r: 8,     // Block size
  p: 1,     // Parallelization
  maxmem: 32 * 1024 * 1024,
};

/**
 * Derives a 256-bit encryption key using scrypt
 * @param {string} password 
 * @param {Buffer} salt 
 * @returns {Buffer} 32-byte derived key
 */
export function deriveKey(password, salt) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
}

/**
 * Encrypts a binary buffer using AES-256-GCM and scrypt
 * @param {Buffer} plainBuffer 
 * @param {string} password 
 * @returns {{ salt: string, iv: string, tag: string, payload: string }}
 */
export function encryptData(plainBuffer, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt);

  try {
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      payload: encrypted.toString('base64'),
    };
  } finally {
    // Zero out the key in memory
    key.fill(0);
  }
}

/**
 * Decrypts an encrypted container using AES-256-GCM and scrypt
 * @param {{ salt: string, iv: string, tag: string, payload: string }} container 
 * @param {string} password 
 * @returns {Buffer} decrypted plain buffer
 */
export function decryptData(container, password) {
  if (!container || !container.salt || !container.iv || !container.tag || !container.payload) {
    throw new Error('Invalid container format: missing required cryptographic components');
  }

  const salt = Buffer.from(container.salt, 'base64');
  const iv = Buffer.from(container.iv, 'base64');
  const tag = Buffer.from(container.tag, 'base64');
  const payload = Buffer.from(container.payload, 'base64');

  const key = deriveKey(password, salt);

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
    return decrypted;
  } catch (err) {
    throw new Error('Decryption failed: Incorrect password or corrupted container payload');
  } finally {
    // Secure memory cleanup
    key.fill(0);
  }
}
