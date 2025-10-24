#!/usr/bin/env node
/*
 Simple dependency scanner:
 - Scans JS files under ./out (built sources) to find require()/import statements
 - Collects external module specifiers (non-relative) and filters Node built-ins
 - Compares with package.json dependencies and prints missing/extra
*/
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'out');
const NODE_MODULES_DIR = path.join(ROOT, 'node_modules');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, files);
    } else if (entry.isFile() && p.endsWith('.js')) {
      files.push(p);
    }
  }
  return files;
}

function extractModulesFromCode(code) {
  const modules = new Set();
  const regexes = [
    /require\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /import\s+[^'"`]*from\s*["'`]([^"'`]+)["'`]/g,
    /import\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];
  for (const re of regexes) {
    let m;
    while ((m = re.exec(code)) !== null) {
      modules.add(m[1]);
    }
  }
  return modules;
}

function topLevelName(spec) {
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.length >= 2 ? parts.slice(0, 2).join('/') : spec;
  }
  return spec.split('/')[0];
}

function isExternal(spec) {
  return !spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('file:') && !spec.startsWith('http');
}

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error(`[ERROR] Out dir not found: ${OUT_DIR}`);
    process.exit(1);
  }
  const files = walk(OUT_DIR);
  const found = new Set();
  for (const f of files) {
    try {
      const code = fs.readFileSync(f, 'utf8');
      const mods = extractModulesFromCode(code);
      for (const spec of mods) {
        if (!isExternal(spec)) continue;
        const name = topLevelName(spec);
        if (!builtinModules.includes(name) && !builtinModules.includes(`node:${name}`)) {
          found.add(name);
        }
      }
    } catch {}
  }
  // const files2 = walk(NODE_MODULES_DIR);
  // for (const f of files2) {
  //   try {
  //     const code = fs.readFileSync(f, 'utf8');
  //     const mods = extractModulesFromCode(code);
  //     for (const spec of mods) {
  //       if (!isExternal(spec)) continue;
  //       const name = topLevelName(spec);
  //       if (!builtinModules.includes(name) && !builtinModules.includes(`node:${name}`)) {
  //         found.add(name);
  //       }
  //     }
  //   } catch {}
  // }
  const used = Array.from(found).sort();
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const declared = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  const declaredNames = new Set(Object.keys(declared));
  const missing = used.filter((n) => !declaredNames.has(n));
  const extra = Array.from(declaredNames).filter((n) => !used.includes(n));

  console.log(JSON.stringify({ used, missing, extra, count: { used: used.length, missing: missing.length, extra: extra.length } }, null, 2));
}

main();
