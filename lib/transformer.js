/**
 * Lightweight, zero-dependency in-memory ES Module (ESM) to CommonJS (CJS) transformer.
 * Allows executing modern ESM JavaScript projects (import/export) inside Node's in-memory VM loader.
 */

/**
 * Checks if code contains ES Module syntax
 * @param {string} code 
 * @returns {boolean}
 */
export function isEsmCode(code = '') {
  return (
    /(?:^|\n)\s*import\s+[\s\S]*?from\s+['"]/.test(code) ||
    /(?:^|\n)\s*import\s+['"][^'"]+['"]/.test(code) ||
    /(?:^|\n)\s*export\s+(?:default|const|let|var|function|class|async|\{)/.test(code) ||
    /import\.meta/.test(code) ||
    /(?:const|let|var)\s+__filename\s*=/.test(code) ||
    /(?:const|let|var)\s+__dirname\s*=/.test(code)
  );
}

/**
 * Transforms ESM code into executable CommonJS for in-memory VM execution
 * @param {string} code 
 * @returns {string} transformed CommonJS code
 */
export function transformEsmToCjs(code) {
  if (!code || !isEsmCode(code)) {
    return code;
  }

  let transformed = code;
  const exportedSymbols = new Set();

  // 1. Remove redundant __filename and __dirname re-declarations (injected by wrapper)
  transformed = transformed.replace(
    /(?:^|\n)\s*(?:const|let|var)\s+__filename\s*=\s*[^;\n]+;?/g,
    '\n/* __filename injected by loader */'
  );
  transformed = transformed.replace(
    /(?:^|\n)\s*(?:const|let|var)\s+__dirname\s*=\s*[^;\n]+;?/g,
    '\n/* __dirname injected by loader */'
  );

  // 2. Transform import.meta
  transformed = transformed
    .replace(/import\.meta\.url/g, "require('url').pathToFileURL(__filename).href")
    .replace(/import\.meta\.dirname/g, '__dirname')
    .replace(/import\.meta\.filename/g, '__filename');

  // 3. Transform side-effect imports: import 'mod'; or import "./file.css";
  transformed = transformed.replace(
    /(?:^|\n)\s*import\s+['"]([^'"]+)['"];?/g,
    (m, p1) => `\nrequire('${p1}');`
  );

  // 4. Transform namespace imports: import * as name from 'mod';
  transformed = transformed.replace(
    /(?:^|\n)\s*import\s+\*\s+as\s+([a-zA-Z0-9_$]+)\s+from\s+['"]([^'"]+)['"];?/g,
    (m, name, modPath) => `\nconst ${name} = require('${modPath}');`
  );

  // 5. Transform default + named imports: import def, { a, b as c } from 'mod';
  transformed = transformed.replace(
    /(?:^|\n)\s*import\s+([a-zA-Z0-9_$]+)\s*,\s*\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"];?/g,
    (m, defName, namedGroup, modPath) => {
      const tempVar = '_m_' + Math.random().toString(36).slice(2, 8);
      const namedBindings = namedGroup
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          if (/\s+as\s+/.test(p)) {
            const [orig, alias] = p.split(/\s+as\s+/);
            return `${orig.trim()}: ${alias.trim()}`;
          }
          return p;
        })
        .join(', ');

      return `\nconst ${tempVar} = require('${modPath}'); const ${defName} = ${tempVar} && ${tempVar}.default !== undefined ? ${tempVar}.default : ${tempVar}; const { ${namedBindings} } = ${tempVar};`;
    }
  );

  // 6. Transform named imports: import { a, b as c } from 'mod';
  transformed = transformed.replace(
    /(?:^|\n)\s*import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?/g,
    (m, namedGroup, modPath) => {
      const namedBindings = namedGroup
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          if (/\s+as\s+/.test(p)) {
            const [orig, alias] = p.split(/\s+as\s+/);
            return `${orig.trim()}: ${alias.trim()}`;
          }
          return p;
        })
        .join(', ');
      return `\nconst { ${namedBindings} } = require('${modPath}');`;
    }
  );

  // 7. Transform default imports: import def from 'mod';
  transformed = transformed.replace(
    /(?:^|\n)\s*import\s+([a-zA-Z0-9_$]+)\s+from\s+['"]([^'"]+)['"];?/g,
    (m, defName, modPath) => {
      const tempVar = '_def_' + Math.random().toString(36).slice(2, 8);
      return `\nconst ${tempVar} = require('${modPath}'); const ${defName} = ${tempVar} && ${tempVar}.default !== undefined ? ${tempVar}.default : ${tempVar};`;
    }
  );

  // 8. Transform export default expression
  transformed = transformed.replace(
    /(?:^|\n)\s*export\s+default\s+([\s\S]*?);?(?=\n|$)/g,
    (m, expr) => `\nmodule.exports = ${expr.trim()}; module.exports.default = ${expr.trim()};`
  );

  // 9. Transform export async function / export function / export class
  transformed = transformed.replace(
    /(?:^|\n)\s*export\s+(async\s+function\*?|function\*?|class)\s+([a-zA-Z0-9_$]+)\b/g,
    (m, kind, name) => {
      exportedSymbols.add(name);
      return `\n${kind} ${name}`;
    }
  );

  // 10. Transform export const / let / var
  transformed = transformed.replace(
    /(?:^|\n)\s*export\s+(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/g,
    (m, kw, name) => {
      exportedSymbols.add(name);
      return `\n${kw} ${name} = exports.${name} =`;
    }
  );

  // 11. Transform export { a, b as c }
  transformed = transformed.replace(
    /(?:^|\n)\s*export\s*\{([\s\S]*?)\};?/g,
    (m, group) => {
      const lines = group
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          if (/\s+as\s+/.test(p)) {
            const [orig, alias] = p.split(/\s+as\s+/);
            return `exports.${alias.trim()} = ${orig.trim()};`;
          }
          return `exports.${p} = ${p};`;
        });
      return '\n' + lines.join('\n');
    }
  );

  // 12. Transform export * from 'mod'
  transformed = transformed.replace(
    /(?:^|\n)\s*export\s*\*\s*from\s*['"]([^'"]+)['"];?/g,
    (m, modPath) => `\nObject.assign(exports, require('${modPath}'));`
  );

  // Append exported function/class symbols safely at the end of the module
  for (const name of exportedSymbols) {
    transformed += `\nif (typeof ${name} !== 'undefined') exports.${name} = ${name};`;
  }

  return transformed;
}
