import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DEFAULT_IGNORE = new Set([
  'node_modules',
  '.git',
  '.DS_Store',
  'dist',
  '.npmrc',
  'npm-debug.log',
  'yarn-debug.log',
  'yarn-error.log',
  'pnpm-debug.log',
]);

/**
 * Checks if a relative path or file name should be ignored
 * @param {string} relativePath 
 * @param {string} baseName 
 * @returns {boolean}
 */
export function shouldIgnore(relativePath, baseName) {
  if (DEFAULT_IGNORE.has(baseName)) return true;
  const parts = relativePath.split(/[/\\]/);
  for (const part of parts) {
    if (DEFAULT_IGNORE.has(part)) return true;
  }
  return false;
}

/**
 * Finds all files recursively in a directory
 * @param {string} dir 
 * @param {string} baseDir 
 * @returns {Array<{ relativePath: string, fullPath: string }>}
 */
export function collectFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (shouldIgnore(relativePath, entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      results = results.concat(collectFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      results.push({ relativePath, fullPath });
    }
  }

  return results;
}

/**
 * Detects the entry point file of a project
 * @param {string} projectDir 
 * @param {string|null} userEntry 
 * @returns {string} normalized relative path to entry file
 */
export function detectEntryPoint(projectDir, userEntry = null) {
  if (userEntry) {
    const normalized = userEntry.replace(/\\/g, '/');
    if (fs.existsSync(path.join(projectDir, normalized))) {
      return normalized;
    }
    throw new Error(`Specified entry point "${userEntry}" does not exist in project directory`);
  }

  // 1. Check package.json main
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.main) {
        const candidate = pkg.main.replace(/^\.\//, '').replace(/\\/g, '/');
        if (fs.existsSync(path.join(projectDir, candidate))) {
          return candidate;
        }
      }
    } catch {}
  }

  // 2. Candidate default list
  const candidates = [
    'index.js',
    'src/index.js',
    'app.js',
    'src/app.js',
    'main.js',
    'src/main.js',
    'cli.js',
    'server.js',
    'src/server.js',
  ];

  for (const c of candidates) {
    if (fs.existsSync(path.join(projectDir, c))) {
      return c;
    }
  }

  throw new Error(
    'Could not automatically determine the entry point (e.g. index.js, app.js, or package.json main). ' +
    'Please specify it with --entry <file>.'
  );
}

/**
 * Serializes and compresses a project directory into a single Buffer
 * @param {string} projectDir 
 * @param {string|null} userEntry 
 * @returns {{ compressedBuffer: Buffer, entry: string, fileCount: number, totalBytes: number }}
 */
export function serializeProject(projectDir, userEntry = null) {
  const absoluteDir = path.resolve(projectDir);
  if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
    throw new Error(`Project directory "${projectDir}" not found`);
  }

  const entry = detectEntryPoint(absoluteDir, userEntry);
  const fileEntries = collectFiles(absoluteDir);

  if (fileEntries.length === 0) {
    throw new Error(`No files found to protect in "${projectDir}"`);
  }

  const files = {};
  let totalBytes = 0;

  for (const item of fileEntries) {
    const buffer = fs.readFileSync(item.fullPath);
    totalBytes += buffer.length;
    files[item.relativePath] = buffer.toString('base64');
  }

  const projectObject = {
    version: 1,
    entry,
    files,
    meta: {
      packedAt: new Date().toISOString(),
      fileCount: fileEntries.length,
      totalSize: totalBytes,
    },
  };

  const jsonString = JSON.stringify(projectObject);
  const compressedBuffer = zlib.brotliCompressSync(Buffer.from(jsonString, 'utf8'), {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
    },
  });

  return {
    compressedBuffer,
    entry,
    fileCount: fileEntries.length,
    totalBytes,
  };
}

/**
 * Decompresses and deserializes a compressed project buffer
 * @param {Buffer} compressedBuffer 
 * @returns {{ entry: string, files: Object.<string, string>, meta: object }}
 */
export function deserializeProject(compressedBuffer) {
  let decompressed;
  try {
    decompressed = zlib.brotliDecompressSync(compressedBuffer);
  } catch (err) {
    try {
      decompressed = zlib.gunzipSync(compressedBuffer);
    } catch {
      throw new Error('Decompression failed: Malformed project payload');
    }
  }

  const jsonString = decompressed.toString('utf8');
  const projectObject = JSON.parse(jsonString);

  if (!projectObject.files || typeof projectObject.files !== 'object') {
    throw new Error('Invalid project structure: missing files dictionary');
  }

  return projectObject;
}
