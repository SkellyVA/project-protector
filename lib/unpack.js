import fs from 'fs';
import path from 'path';
import { decryptData } from './crypto.js';
import { deserializeProject } from './serializer.js';

/**
 * Extracts container JSON from a protected app.js file
 * @param {string} filePath 
 * @returns {object} container object
 */
export function extractContainerFromFile(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Protected file "${filePath}" not found`);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');

  // Match CONTAINER = { ... } in the bootstrap code
  const match = content.match(/const CONTAINER = (\{[\s\S]*?\n\};)/);
  if (!match) {
    throw new Error(`Could not locate valid container payload in "${filePath}"`);
  }

  try {
    const rawJson = match[1].replace(/;\s*$/, '');
    return JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`Failed to parse container JSON: ${err.message}`);
  }
}

/**
 * Restores all project files from an encrypted container to disk
 * @param {string} protectedFilePath 
 * @param {string} targetDir 
 * @param {string} password 
 * @returns {{ targetDir: string, restoredFiles: string[], entry: string }}
 */
export function unpackProject(protectedFilePath, targetDir, password) {
  const container = extractContainerFromFile(protectedFilePath);

  // 1. Decrypt
  const decryptedBuffer = decryptData(container, password);

  // 2. Decompress and parse project
  const project = deserializeProject(decryptedBuffer);

  // 3. Write files and directories to target output folder
  const resolvedTarget = path.resolve(targetDir);
  if (!fs.existsSync(resolvedTarget)) {
    fs.mkdirSync(resolvedTarget, { recursive: true });
  }

  const restoredFiles = [];

  for (const [relativePath, base64Content] of Object.entries(project.files)) {
    const filePath = path.join(resolvedTarget, relativePath);
    const dirName = path.dirname(filePath);

    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }

    const fileBuffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(filePath, fileBuffer);
    restoredFiles.push(relativePath);
  }

  return {
    targetDir: resolvedTarget,
    restoredFiles,
    entry: project.entry,
  };
}
