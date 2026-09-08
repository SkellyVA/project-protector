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

  let password = options.password || process.env.PROJECT_PASSWORD;
  if (!password) {
    password = await promptPassword('🔑 Enter secret password: ');
    if (!password) {
      console.error('\x1b[31m❌ Error: Password cannot be empty.\x1b[0m');
      process.exit(1);
    }
  }

  let decryptedBuffer;
  try {
    decryptedBuffer = decryptData(container, password);
  } catch (err) {
    console.error(`\x1b[31m❌ ${err.message}\x1b[0m`);
    process.exit(1);
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
