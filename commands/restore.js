import path from 'path';
import { unpackProject } from '../lib/unpack.js';
import { promptPassword } from '../lib/prompt.js';

/**
 * Handles the 'restore' CLI command
 * @param {string} appJsPath 
 * @param {string|null} outputDir 
 * @param {object} options 
 */
export async function handleRestore(appJsPath, outputDir = null, options = {}) {
  if (!appJsPath) {
    console.error('\x1b[31m❌ Error: Please specify the protected app.js file to restore.\x1b[0m');
    console.log('Usage: protector restore <path-to-app.js> [output-directory]');
    process.exit(1);
  }

  const resolvedFile = path.resolve(appJsPath);
  const targetDir = outputDir ? path.resolve(outputDir) : path.join(path.dirname(resolvedFile), 'restored_project');

  console.log(`🔓 Restoring protected file: \x1b[36m${resolvedFile}\x1b[0m`);
  console.log(`📂 Destination directory:    \x1b[36m${targetDir}\x1b[0m`);

  let password = options.password || process.env.PROJECT_PASSWORD;
  if (!password) {
    password = await promptPassword('🔑 Enter secret password: ');
    if (!password) {
      console.error('\x1b[31m❌ Error: Password cannot be empty.\x1b[0m');
      process.exit(1);
    }
  }

  try {
    const result = unpackProject(resolvedFile, targetDir, password);

    console.log('\n\x1b[32m✅ Project restored successfully!\x1b[0m');
    console.log(`📄 Files restored: \x1b[33m${result.restoredFiles.length}\x1b[0m`);
    console.log(`🎯 Entry point:    \x1b[33m${result.entry}\x1b[0m`);
    console.log(`📁 Directory:      \x1b[36m${result.targetDir}\x1b[0m\n`);
  } catch (err) {
    console.error(`\x1b[31m❌ Restoration Failed: ${err.message}\x1b[0m`);
    process.exit(1);
  }
}
