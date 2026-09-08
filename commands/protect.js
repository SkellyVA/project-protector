import path from 'path';
import { packProject } from '../lib/pack.js';
import { promptPassword } from '../lib/prompt.js';

/**
 * Handles the 'protect' CLI command
 * @param {string} projectDir 
 * @param {string|null} outputPath 
 * @param {object} options 
 */
export async function handleProtect(projectDir, outputPath = null, options = {}) {
  const targetProjectDir = projectDir || '.';
  const targetOutput = outputPath || path.join(targetProjectDir, 'dist', 'app.js');

  console.log(`🔒 Protecting project: \x1b[36m${path.resolve(targetProjectDir)}\x1b[0m`);

  // Prompt for password
  let password = options.password || process.env.PROJECT_PASSWORD;
  if (!password) {
    password = await promptPassword('🔑 Enter secret password to protect project: ');
    if (!password) {
      console.error('\x1b[31m❌ Error: Password cannot be empty.\x1b[0m');
      process.exit(1);
    }

    const confirm = await promptPassword('🔑 Confirm password: ');
    if (password !== confirm) {
      console.error('\x1b[31m❌ Error: Passwords do not match.\x1b[0m');
      process.exit(1);
    }
  }

  console.log('📦 Reading, compressing, and encrypting project files...');
  const result = packProject(targetProjectDir, targetOutput, password, options.entry || null);

  const formatBytes = (bytes) => (bytes / 1024).toFixed(2) + ' KB';

  console.log('\n\x1b[32m✅ Project successfully protected!\x1b[0m');
  console.log(`📁 Files packed:     \x1b[33m${result.fileCount}\x1b[0m`);
  console.log(`📊 Original size:    \x1b[33m${formatBytes(result.originalSize)}\x1b[0m`);
  console.log(`🗜️ Encrypted size:   \x1b[33m${formatBytes(result.compressedSize)}\x1b[0m`);
  console.log(`🚀 Executable file:  \x1b[36m${result.outputPath}\x1b[0m\n`);
  console.log('You can now run this standalone executable directly:');
  console.log(`  \x1b[35mnode ${path.relative(process.cwd(), result.outputPath) || result.outputPath}\x1b[0m`);
  console.log('Or with the CLI:');
  console.log(`  \x1b[35mprotector run ${path.relative(process.cwd(), result.outputPath) || result.outputPath}\x1b[0m\n`);
}
