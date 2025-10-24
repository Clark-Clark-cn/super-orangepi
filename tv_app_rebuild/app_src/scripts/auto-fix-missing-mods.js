#!/usr/bin/env node
/*
 Auto fix missing modules during runtime:
 - Runs dist/linux-arm64-unpacked/dianshitime and captures stderr/stdout
 - Parses "Cannot find module '...'") messages
 - Maps subpath imports to top-level package (e.g., lodash/sortBy -> lodash)
 - Installs via `cnpm install <pkg> --save`
 - Rebuilds the app (cnpm run build)
 - Retries until no missing module error or max iterations reached

 Notes:
 - Requires a working X display if the app needs GUI. This script ignores non-module errors.
 - Ignores platform-specific packages on Linux (e.g., electron-builder-squirrel-windows, dmg-builder).
  - If encountering Error [ERR_REQUIRE_ESM], it will downgrade the last installed module to the latest stable version from the previous major.
*/
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DIST_BIN = path.join(ROOT, 'dist', 'linux-arm64-unpacked', 'dianshitime');
const MAX_ITER = 100;
const BUILD_CMD = process.env.BUILD_CMD || 'cnpm run build';
const INSTALL_CMD = (pkgs) => `cnpm install ${pkgs.join(' ')} --save`;
const VIEW_VERSIONS_CMD = (name) => `cnpm view ${name} versions --json`;

// Ignore list on Linux
const IGNORE = new Set([
  'electron-builder-squirrel-windows',
  'dmg-builder',
  'dmg-license',
  '@nut-tree-fork/libnut-darwin',
  '@nut-tree-fork/libnut-win32',
  '@nut-tree-fork/node-mac-permissions'
]);

// Keep track of modules that were installed by this script in order
const installedHistory = [];

function topLevelName(spec) {
  if (!spec) return spec;
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.length >= 2 ? parts.slice(0, 2).join('/') : spec;
  }
  return spec.split('/')[0];
}

function parseMissingModules(output) {
  const missing = new Set();
  const re = /Cannot find module '\s*([^'\s]+)\s*'/g;
  let m;
  while ((m = re.exec(output)) !== null) {
    let name = m[1];
    // Clean quotes/backticks if any weirdness
    name = name.replace(/^\s+|\s+$/g, '');
    const top = topLevelName(name);
    if (!IGNORE.has(top)) missing.add(top);
  }
  return Array.from(missing);
}

function detectEsmError(output) {
  return /Error\s*\[ERR_REQUIRE_ESM\]/i.test(output);
}

function extractModuleFromPath(output) {
  // Try to recover module name from paths like .../app.asar/node_modules/<name>/...
  const re = /node_modules\/(?:@[^\/]+\/[^\/]+|[^\/]+)/g;
  const m = re.exec(output);
  if (!m) return null;
  const seg = m[0].replace('node_modules/', '');
  return seg;
}

function runBinaryAndCollect() {
  if (!fs.existsSync(DIST_BIN)) {
    console.error(`[auto-fix] dist binary not found at ${DIST_BIN}, running initial build...`);
    const r = spawnSync(BUILD_CMD, { shell: true, stdio: 'inherit' });
    if (r.status !== 0) {
      throw new Error('[auto-fix] initial build failed');
    }
  }

  return new Promise((resolve) => {
    const env = { ...process.env, ELECTRON_ENABLE_LOGGING: '1' };
    const child = spawn(DIST_BIN, { env });
    let out = '';
    let err = '';

    const timeout = setTimeout(() => {
      // If still running after timeout, kill it
      try { child.kill('SIGTERM'); } catch {}
    }, 10000);

    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      const combined = out + '\n' + err;
      resolve({ code, out, err, combined });
    });
  });
}

function getDeclaredDeps() {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);
  return deps;
}

function getCurrentDeclaredVersion(name) {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const v = (pkg.dependencies && pkg.dependencies[name]) || (pkg.devDependencies && pkg.devDependencies[name]);
  if (!v) return null;
  // strip common range operators
  return String(v).replace(/^[\^~><=\s]*/, '').trim();
}

function getPreviousStableVersion(name, current) {
  // Query available versions via cnpm view
  let out = spawnSync(VIEW_VERSIONS_CMD(name), { shell: true, encoding: 'utf8' });
  if (out.status !== 0 || !out.stdout) {
    // Try cnpm info as fallback
    out = spawnSync(`cnpm info ${name} versions --json`, { shell: true, encoding: 'utf8' });
    if (out.status !== 0 || !out.stdout) return null;
  }
  let versions;
  try {
    versions = JSON.parse(out.stdout);
  } catch {
    return null;
  }
  if (!Array.isArray(versions) || versions.length === 0) return null;

  // Helper to parse x.y.z
  const parse = (v) => {
    const m = /^([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(v);
    if (!m) return null;
    return { major: +m[1], minor: +m[2], patch: +m[3], raw: v };
  };
  const cmp = (a, b) => {
    if (a.major !== b.major) return b.major - a.major;
    if (a.minor !== b.minor) return b.minor - a.minor;
    return b.patch - a.patch;
  };

  // Normalize current version (strip prerelease/build if present)
  const curOnly = (current || '').split('-')[0];
  const cur = parse(curOnly);
  if (!cur) return null;

  // pick latest stable from previous major (exclude prerelease with '-')
  const stable = versions
    .filter((v) => typeof v === 'string' && !v.includes('-'))
    .map(parse)
    .filter(Boolean);
  const candidates = stable.filter((s) => s.major < cur.major);
  if (candidates.length === 0) return null;
  candidates.sort(cmp);
  return candidates[0].raw;
}

function downgradeLastInstalledOrGuess(output) {
  // Prefer the most recently installed module in this session
  let target = installedHistory.length ? installedHistory[installedHistory.length - 1] : null;
  if (!target) {
    // Try infer from error path
    const inferred = extractModuleFromPath(output);
    if (inferred) target = topLevelName(inferred);
  }
  if (!target) return { ok: false, reason: 'no-target' };

  const current = getCurrentDeclaredVersion(target);
  if (!current) return { ok: false, reason: 'no-declared-version', target };
  const prev = getPreviousStableVersion(target, current);
  if (!prev) return { ok: false, reason: 'no-prev-version', target, current };

  console.log(`[auto-fix] Detected ESM error. Downgrading ${target} from ${current} -> ${prev} ...`);
  const r = spawnSync(`cnpm install ${target}@${prev} --save`, { shell: true, stdio: 'inherit' });
  if (r.status !== 0) return { ok: false, reason: 'install-failed', target, current, prev };
  installedHistory.push(target);
  return { ok: true, target, current, prev };
}

async function main() {
  let iteration = 0;
  while (iteration < MAX_ITER) {
    iteration += 1;
    console.log(`\n[auto-fix] Iteration ${iteration}/${MAX_ITER} -> launching binary...`);
    const { combined } = await runBinaryAndCollect();

    // If ESM error occurred, try to downgrade last installed module version first
    if (detectEsmError(combined)) {
      const res = downgradeLastInstalledOrGuess(combined);
      if (!res.ok) {
        console.error(`[auto-fix] ESM downgrade skipped/failed (${res.reason}). You may need to pin a CJS-compatible version manually.`);
        process.exit(4);
      }
      console.log('[auto-fix] Rebuilding after downgrade...');
      const rb1 = spawnSync(BUILD_CMD, { shell: true, stdio: 'inherit' });
      if (rb1.status !== 0) {
        console.error('[auto-fix] Build failed after downgrade.');
        process.exit(rb1.status || 1);
      }
      // Continue next iteration
      continue;
    }

    // First, detect missing module errors
    const missing = parseMissingModules(combined);
    if (missing.length === 0) {
      // If no missing module messages, check if it's display error and abort with hint
      if (/Missing X server|The platform failed to initialize|ozone_platform_x11/i.test(combined)) {
        console.error('[auto-fix] Electron GUI cannot start (DISPLAY/X not ready). Set DISPLAY=:0 (or ensure GUI) and retry.');
        process.exit(2);
      }
    }

    const declared = getDeclaredDeps();
    const toInstall = missing.filter((m) => !declared.has(m));

    if (toInstall.length === 0) {
      console.log('[auto-fix] Missing modules found, but all are already declared in package.json. Rebuilding...');
    } else {
      console.log(`[auto-fix] Will install ${toInstall.length} missing module(s): ${toInstall.join(', ')}`);
      const r = spawnSync(INSTALL_CMD(toInstall), { shell: true, stdio: 'inherit' });
      if (r.status !== 0) {
        console.error('[auto-fix] Install failed. You can rerun this script after fixing network or registry issues.');
        process.exit(r.status || 1);
      }
      // Record install history (for potential downgrade on ESM error)
      for (const pkg of toInstall) installedHistory.push(pkg);
    }

    console.log('[auto-fix] Rebuilding package...');
    const rb = spawnSync(BUILD_CMD, { shell: true, stdio: 'inherit' });
    if (rb.status !== 0) {
      console.error('[auto-fix] Build failed. Aborting.');
      process.exit(rb.status || 1);
    }
  }

  console.error(`[auto-fix] Reached max iterations (${MAX_ITER}) without fully resolving.`);
  process.exit(3);
}

main().catch((e) => {
  console.error('[auto-fix] Unexpected error:', e);
  process.exit(1);
});
