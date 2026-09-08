import path from 'path';
import vm from 'vm';
import { Module } from 'module';
import { execSync } from 'child_process';
import { transformEsmToCjs } from './transformer.js';

/**
 * Loads encrypted in-memory .env configuration into process.env before project execution
 * @param {{ files: Object.<string, string> }} project 
 */
export function loadVirtualEnv(project) {
  if (!project.files) return;

  const envKey = project.files['.env'] ? '.env' : project.files['.env.local'] ? '.env.local' : null;
  if (!envKey) return;

  try {
    const raw = Buffer.from(project.files[envKey], 'base64').toString('utf8');
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        let val = trimmed.slice(eqIndex + 1).trim();

        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }

        // Set if not already provided by the host environment
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Error parsing in-memory .env:', err.message);
  }
}

/**
 * Checks and automatically installs any missing npm dependencies defined in the project's package.json
 * @param {{ files: Object.<string, string> }} project 
 */
export function ensureDependenciesInstalled(project) {
  if (!project.files || !project.files['package.json']) return;

  try {
    const pkgContent = Buffer.from(project.files['package.json'], 'base64').toString('utf8');
    const pkg = JSON.parse(pkgContent);
    const deps = Object.keys(pkg.dependencies || {});

    if (deps.length > 0) {
      const missing = deps.filter((dep) => {
        try {
          Module._resolveFilename(dep, { paths: Module._nodeModulePaths(process.cwd()) }, false);
          return false;
        } catch {
          return true;
        }
      });

      if (missing.length > 0) {
        console.log('\n\x1b[36m📦 First run detected on this machine.\x1b[0m');
        console.log(`⚡ Automatically installing missing dependencies: \x1b[33m${missing.join(', ')}\x1b[0m...`);
        execSync(`npm install ${missing.join(' ')} --no-audit --no-fund`, {
          stdio: 'inherit',
          cwd: process.cwd(),
        });
        console.log('\x1b[32m✅ Dependencies installed successfully! Launching in-memory execution...\x1b[0m\n');
      }
    }
  } catch (err) {
    console.warn('⚠️ Dependency auto-installer note:', err.message);
  }
}

/**
 * In-Memory Virtual Module Loader
 * Executes JavaScript projects directly from memory without writing a single file to disk.
 * Supports both CommonJS (require) and ES Modules (import/export).
 */
export class InMemoryLoader {
  /**
   * @param {{ entry: string, files: Object.<string, string> }} project
   */
  constructor(project) {
    this.entry = project.entry.replace(/\\/g, '/');
    this.virtualFiles = new Map();
    this.moduleCache = new Map();

    for (const [relPath, base64Content] of Object.entries(project.files)) {
      const normalized = path.posix.normalize(relPath.replace(/\\/g, '/')).replace(/^\.\//, '');
      this.virtualFiles.set(normalized, Buffer.from(base64Content, 'base64'));
    }
  }

  resolvePath(request, parentVirtualDir = '.') {
    if (Module.isBuiltin(request)) {
      return { isVirtual: false, nativeModule: true };
    }

    if (request.startsWith('./') || request.startsWith('../') || request.startsWith('/')) {
      const combined = request.startsWith('/')
        ? path.posix.normalize(request.slice(1))
        : path.posix.normalize(path.posix.join(parentVirtualDir, request));

      const candidates = [
        combined,
        combined + '.js',
        combined + '.cjs',
        combined + '.mjs',
        combined + '.json',
        path.posix.join(combined, 'index.js'),
        path.posix.join(combined, 'index.json'),
      ];

      for (const candidate of candidates) {
        const clean = candidate.replace(/^\.\//, '');
        if (this.virtualFiles.has(clean)) {
          return { isVirtual: true, virtualPath: clean };
        }
      }

      const pkgPath = path.posix.join(combined, 'package.json').replace(/^\.\//, '');
      if (this.virtualFiles.has(pkgPath)) {
        try {
          const pkgData = JSON.parse(this.virtualFiles.get(pkgPath).toString('utf8'));
          if (pkgData.main) {
            const mainFile = path.posix.join(combined, pkgData.main).replace(/^\.\//, '');
            if (this.virtualFiles.has(mainFile)) {
              return { isVirtual: true, virtualPath: mainFile };
            }
            if (this.virtualFiles.has(mainFile + '.js')) {
              return { isVirtual: true, virtualPath: mainFile + '.js' };
            }
          }
        } catch {}
      }
    }

    return { isVirtual: false };
  }

  loadVirtualModule(virtualPath) {
    const cleanPath = path.posix.normalize(virtualPath).replace(/^\.\//, '');

    if (this.moduleCache.has(cleanPath)) {
      return this.moduleCache.get(cleanPath).exports;
    }

    if (!this.virtualFiles.has(cleanPath)) {
      throw new Error(`Cannot find virtual module '${virtualPath}' in memory`);
    }

    const fileBuffer = this.virtualFiles.get(cleanPath);
    const virtualDir = path.posix.dirname(cleanPath);

    const fakeFilename = path.resolve(process.cwd(), cleanPath);
    const fakeDirname = path.resolve(process.cwd(), virtualDir);

    const mod = new Module(fakeFilename, null);
    mod.filename = fakeFilename;
    mod.paths = Module._nodeModulePaths(process.cwd());
    this.moduleCache.set(cleanPath, mod);

    if (cleanPath.endsWith('.json')) {
      try {
        mod.exports = JSON.parse(fileBuffer.toString('utf8'));
        return mod.exports;
      } catch (err) {
        throw new Error(`Error parsing virtual JSON file ${cleanPath}: ${err.message}`);
      }
    }

    const customRequire = (specifier) => {
      const resolved = this.resolvePath(specifier, virtualDir);

      if (resolved.isVirtual) {
        return this.loadVirtualModule(resolved.virtualPath);
      }

      if (resolved.nativeModule) {
        return Module._load(specifier, null, false);
      }

      try {
        return Module._load(specifier, mod, false);
      } catch {
        return require(specifier);
      }
    };

    customRequire.resolve = (specifier) => {
      const resolved = this.resolvePath(specifier, virtualDir);
      if (resolved.isVirtual) {
        return path.resolve(process.cwd(), resolved.virtualPath);
      }
      return require.resolve(specifier, { paths: [fakeDirname, process.cwd()] });
    };

    customRequire.main = process.mainModule || mod;
    customRequire.cache = {};

    const rawCode = fileBuffer.toString('utf8');
    const code = transformEsmToCjs(rawCode);

    const wrapper = vm.compileFunction(
      code,
      ['exports', 'require', 'module', '__filename', '__dirname'],
      {
        filename: fakeFilename,
        lineOffset: 0,
        displayErrors: true,
      }
    );

    wrapper.call(mod.exports, mod.exports, customRequire, mod, fakeFilename, fakeDirname);
    mod.loaded = true;

    return mod.exports;
  }

  run() {
    return this.loadVirtualModule(this.entry);
  }
}

/**
 * Convenience helper to execute a project in memory
 * @param {{ entry: string, files: Object.<string, string> }} project
 */
export function executeProjectInMemory(project) {
  loadVirtualEnv(project);
  ensureDependenciesInstalled(project);
  const loader = new InMemoryLoader(project);
  return loader.run();
}
