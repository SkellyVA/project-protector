import path from 'path';
import { extractContainerFromFile } from '../lib/unpack.js';
import { decryptData } from '../lib/crypto.js';
import { deserializeProject } from '../lib/serializer.js';
import { executeProjectInMemory } from '../lib/loader.js';
import { promptPassword } from '../lib/prompt.js';

/**
 * Handles the 'run' CLI command
 * @param {string} appJsPath 
 * @param {object} options 
 */
export async function handleRun(appJsPath, options = {}) {
  if (!appJsPath) {
    console.error('\x1b[31m❌ Error: Please specify the protected app.js file to run.\x1b[0m');
    console.log('Usage: protector run <path-to-app.js>');
    process.exit(1);
  }

  const resolvedFile = path.resolve(appJsPath);
  const container = extractContainerFromFile(resolvedFile);

  let decryptedBuffer;

  if (container.runtime) {
    // Zero-password in-memory execution for v2 container
    try {
      const k1 = Buffer.from(container.runtime.k1, 'base64');
      const k2 = Buffer.from(container.runtime.k2, 'base64');
      const key = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        key[i] = k1[i] ^ k2[i];
      }
      const iv = Buffer.from(container.runtime.iv, 'base64');
      const tag = Buffer.from(container.runtime.tag, 'base64');
      const payload = Buffer.from(container.runtime.payload, 'base64');

      const crypto = await import('crypto');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
        authTagLength: 16,
      });
      decipher.setAuthTag(tag);
      decryptedBuffer = Buffer.concat([decipher.update(payload), decipher.final()]);
      key.fill(0);
    } catch (err) {
      console.error(`\x1b[31m❌ Decryption error: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  } else {
    // Password-protected v1 container
    let password = options.password || process.env.PROJECT_PASSWORD;
    if (!password) {
      password = await promptPassword('🔑 Enter secret password: ');
      if (!password) {
        console.error('\x1b[31m❌ Error: Password cannot be empty.\x1b[0m');
        process.exit(1);
      }
    }

    try {
      decryptedBuffer = decryptData(container, password);
    } catch (err) {
      console.error(`\x1b[31m❌ ${err.message}\x1b[0m`);
      process.exit(1);
    }
  }

  const project = deserializeProject(decryptedBuffer);

  try {
    // Execute in memory
    executeProjectInMemory(project);
  } catch (err) {
    console.error('💥 Runtime Error in protected project:', err);
    process.exit(1);
  }
}
