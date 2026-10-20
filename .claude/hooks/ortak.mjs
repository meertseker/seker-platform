// Ajan hook'larının ortak yardımcıları: rol tespiti ve defter klasörü.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export function git(cwd, ...args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// Defter, ana repo klasörünün yanındaki seker-platform-ledgers. Worktree'lerden de
// aynı yere çıkmak için git'in ortak .git klasöründen hesaplanır.
export function ledgerDir(cwd) {
  const common = git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  const repoRoot = common ? dirname(common) : cwd;
  return resolve(repoRoot, '..', 'seker-platform-ledgers');
}

// Koordinatör: SEKER_ROLE=koordinator ile açılmış oturum ya da kimliği
// seker-platform-ledgers/koordinator dosyasında yazılı oturum.
export function isCoordinator(cwd, sessionId) {
  if ((process.env.SEKER_ROLE || '').toLowerCase() === 'koordinator') return true;
  const file = join(ledgerDir(cwd), 'koordinator');
  if (!sessionId || !existsSync(file)) return false;
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*/, '').trim())
    .includes(sessionId);
}
