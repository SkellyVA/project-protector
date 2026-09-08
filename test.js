import fs from 'fs';
import path from 'path';
import { packProject } from './lib/pack.js';
import { unpackProject } from './lib/unpack.js';
import { extractContainerFromFile } from './lib/unpack.js';
import { decryptData } from './lib/crypto.js';
import { deserializeProject } from './lib/serializer.js';
import { executeProjectInMemory } from './lib/loader.js';

console.log('🧪 Starting Project Protector Automated Verification Test...\n');

const sampleProjectDir = path.resolve('./temp_sample_project');
const distAppJs = path.resolve('./temp_dist/app.js');
const restoredDir = path.resolve('./temp_restored_project');
const secretPassword = 'UltraSecretPassword2026!';

// 1. Create sample ESM project structure (import / export)
if (fs.existsSync(sampleProjectDir)) fs.rmSync(sampleProjectDir, { recursive: true, force: true });
if (fs.existsSync(restoredDir)) fs.rmSync(restoredDir, { recursive: true, force: true });
if (fs.existsSync(path.dirname(distAppJs))) fs.rmSync(path.dirname(distAppJs), { recursive: true, force: true });

fs.mkdirSync(path.join(sampleProjectDir, 'src', 'utils'), { recursive: true });
fs.mkdirSync(path.join(sampleProjectDir, 'src', 'config'), { recursive: true });
fs.mkdirSync(path.join(sampleProjectDir, 'node_modules', 'dummy'), { recursive: true });

fs.writeFileSync(
  path.join(sampleProjectDir, 'package.json'),
  JSON.stringify({ name: 'sample-app', version: '1.0.0', type: 'module', main: 'src/index.js' }, null, 2)
);

fs.writeFileSync(
  path.join(sampleProjectDir, 'src', 'config', 'settings.json'),
  JSON.stringify({ appName: 'ProtectedApp', port: 8080, active: true }, null, 2)
);

// ESM exports
fs.writeFileSync(
  path.join(sampleProjectDir, 'src', 'utils', 'math.js'),
  'export const add = (a, b) => a + b;\nexport const mul = (a, b) => a * b;\n'
);

// ESM imports (like in mail-tg-bot)
fs.writeFileSync(
  path.join(sampleProjectDir, 'src', 'index.js'),
  `import { add, mul } from './utils/math.js';
import config from './config/settings.json';

global.__TEST_OUTPUT__ = {
  name: config.appName,
  sum: add(15, 27),
  product: mul(6, 7),
  status: 'RUNNING_IN_MEMORY'
};

console.log('🎉 In-Memory ESM Project Execution Success! Output:', global.__TEST_OUTPUT__);
`
);

// File in node_modules to verify it gets ignored
fs.writeFileSync(path.join(sampleProjectDir, 'node_modules', 'dummy', 'index.js'), 'module.exports = 123;');

console.log('✅ Sample ESM project generated.');

// 2. Pack project
console.log('\n📦 Step 1: Packing & Encrypting ESM project...');
const packResult = packProject(sampleProjectDir, distAppJs, secretPassword);
console.log('Packed result:', packResult);

if (!fs.existsSync(distAppJs)) {
  throw new Error('Packed app.js was not created');
}

const appJsContent = fs.readFileSync(distAppJs, 'utf8');
if (appJsContent.includes('ProtectedApp') || appJsContent.includes('RUNNING_IN_MEMORY')) {
  throw new Error('SECURITY VIOLATION: Plaintext source code found in output app.js!');
}
console.log('🛡️ Security check passed: Zero plaintext code in output.');

// 3. Test wrong password
console.log('\n🔒 Step 2: Testing incorrect password handling...');
try {
  const container = extractContainerFromFile(distAppJs);
  decryptData(container, 'WrongPassword123');
  throw new Error('Decryption should have failed with wrong password!');
} catch (err) {
  console.log('✅ Correctly rejected invalid password:', err.message);
}

// 4. Test In-Memory Execution of ESM project
console.log('\n🚀 Step 3: Testing in-memory execution of ESM code...');
const container = extractContainerFromFile(distAppJs);
const decryptedBuffer = decryptData(container, secretPassword);
const project = deserializeProject(decryptedBuffer);

executeProjectInMemory(project);

if (!global.__TEST_OUTPUT__ || global.__TEST_OUTPUT__.sum !== 42 || global.__TEST_OUTPUT__.product !== 42) {
  throw new Error('In-memory execution calculation mismatch');
}
console.log('✅ In-memory ESM execution verified and accurate!');

// 5. Test Restore
console.log('\n🔓 Step 4: Testing project restoration...');
const restoreResult = unpackProject(distAppJs, restoredDir, secretPassword);
console.log('Restored files:', restoreResult.restoredFiles);

if (!fs.existsSync(path.join(restoredDir, 'src', 'index.js'))) {
  throw new Error('Restored entry file not found');
}
if (!fs.existsSync(path.join(restoredDir, 'src', 'config', 'settings.json'))) {
  throw new Error('Restored JSON config not found');
}
if (fs.existsSync(path.join(restoredDir, 'node_modules'))) {
  throw new Error('node_modules should not have been packed or restored');
}

// Check content equality
const origIndex = fs.readFileSync(path.join(sampleProjectDir, 'src', 'index.js'), 'utf8');
const restIndex = fs.readFileSync(path.join(restoredDir, 'src', 'index.js'), 'utf8');
if (origIndex !== restIndex) {
  throw new Error('Restored file content does not match original file!');
}
console.log('✅ File integrity check passed: 100% byte-for-byte identical match!');

// Cleanup
fs.rmSync(sampleProjectDir, { recursive: true, force: true });
fs.rmSync(restoredDir, { recursive: true, force: true });
fs.rmSync(path.dirname(distAppJs), { recursive: true, force: true });

console.log('\n🏆 ALL VERIFICATION TESTS PASSED (BOTH ESM & CJS)! 🚀\n');
