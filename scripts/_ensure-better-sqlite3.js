/**
 * Shared helper to keep better-sqlite3's native binary in sync with the Node.js
 * ABI of the CURRENT process. Fixes the "NODE_MODULE_VERSION mismatch / ERR_DLOPEN_FAILED"
 * error that happens when one terminal rebuilds for Node A and another terminal
 * runs scripts with Node B that share the same node_modules.
 *
 * Strategy:
 *   1. Probe with a child process spawned from process.execPath (NOT PATH).
 *      This guarantees the probe uses the exact Node binary that is running now.
 *   2. If loading fails because of ABI mismatch, run `npm rebuild better-sqlite3`
 *      with `path.dirname(process.execPath)` prepended to PATH, so npm resolves
 *      `node` to the same binary and prebuild-install / node-gyp target the right ABI.
 *   3. Re-probe once. Throw if still failing.
 *
 * Also exports envWithNodeOnPath(baseEnv) to let callers spawn child processes
 * (npx, node, prisma) using the SAME Node as the current process.
 *
 * English only by design (this file is edited by automated tooling that must
 * never touch Japanese-containing files).
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const IS_WIN = process.platform === 'win32';
const PATH_SEP = IS_WIN ? ';' : ':';
const PATH_KEY = IS_WIN ? 'Path' : 'PATH';

function findRepoRoot() {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(__dirname, '..');
}

const ROOT = findRepoRoot();
const NODE_DIR = path.dirname(process.execPath);

/**
 * Return a shallow-cloned env object with the current Node.js directory
 * prepended to PATH. Pass this to child processes (spawnSync/execSync) so they
 * resolve `node` / `npm` / `npx` to the same Node binary as the parent.
 */
function envWithNodeOnPath(baseEnv) {
  const env = { ...(baseEnv || process.env) };
  // On Windows, env is usually case-insensitive but Node's child_process preserves
  // the key casing. Handle both `PATH` and `Path` to be safe.
  const currentPath = env.PATH || env.Path || '';
  const prefixed = NODE_DIR + PATH_SEP + currentPath;
  env.PATH = prefixed;
  if (IS_WIN) env.Path = prefixed;
  return env;
}

function probeLoad() {
  // Important: `require('better-sqlite3')` alone does NOT trigger loading of the
  // native .node binary; it only loads JS wrappers. The native addon is resolved
  // lazily via `bindings()` when you actually instantiate a Database. To detect
  // both ABI mismatches and corrupted/missing binaries, we MUST create a DB.
  const probe = "const D=require('better-sqlite3');const d=new D(':memory:');d.close();";
  const r = spawnSync(
    process.execPath,
    ['-e', probe],
    { cwd: ROOT, encoding: 'utf8' }
  );
  return {
    ok: r.status === 0,
    msg: String(r.stderr || '') + String(r.stdout || ''),
  };
}

function looksLikeAbiError(msg) {
  return /NODE_MODULE_VERSION/i.test(msg)
    || /ERR_DLOPEN_FAILED/i.test(msg)
    || /was compiled against/i.test(msg);
}

function runRebuild() {
  const env = envWithNodeOnPath(process.env);
  const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
  console.log(`[ensure-better-sqlite3] rebuilding for node ${process.version} (${process.arch}, modules=${process.versions.modules}) ...`);
  // Windows requires shell:true to spawn .cmd/.bat (Node security hardening
  // since v18.20.2 / v20.12.2 / v22). Using shell:true is safe here because
  // we don't pass any user-controlled arguments.
  const r = spawnSync(npmCmd, ['rebuild', 'better-sqlite3'], {
    cwd: ROOT,
    stdio: 'inherit',
    env,
    shell: IS_WIN,
  });
  if (r.status !== 0) {
    throw new Error(
      'npm rebuild better-sqlite3 failed with code ' + r.status +
      (r.error ? ' (' + r.error.message + ')' : '')
    );
  }
}

/**
 * Ensure better-sqlite3 loads under the current Node.js.
 * Rebuilds automatically on ABI mismatch. No-op when already OK.
 */
function ensureBetterSqlite3Abi() {
  const first = probeLoad();
  if (first.ok) return;
  if (!looksLikeAbiError(first.msg)) {
    throw new Error('[ensure-better-sqlite3] unexpected error (not an ABI mismatch): ' + first.msg);
  }
  console.log('[ensure-better-sqlite3] ABI mismatch detected. Running npm rebuild better-sqlite3...');
  runRebuild();
  const second = probeLoad();
  if (!second.ok) {
    throw new Error('[ensure-better-sqlite3] still failing after rebuild: ' + second.msg);
  }
  console.log('[ensure-better-sqlite3] OK');
}

module.exports = {
  ensureBetterSqlite3Abi,
  envWithNodeOnPath,
  ROOT,
  NODE_DIR,
};

if (require.main === module) {
  try {
    ensureBetterSqlite3Abi();
  } catch (e) {
    console.error(String((e && e.message) || e));
    process.exit(1);
  }
}
