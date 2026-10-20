// SessionStart: oturuma rolünü, dalını, worktree'sini ve defter durumunu söyler.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, isCoordinator, ledgerDir, readStdin } from './ortak.mjs';

try {
  const input = readStdin();
  const cwd = input.cwd || process.cwd();
  const top = git(cwd, 'rev-parse', '--show-toplevel');
  const branch = git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD');
  const behind = git(cwd, 'rev-list', '--count', 'HEAD..origin/main');
  const dirty = git(cwd, 'status', '--porcelain').split('\n').filter(Boolean).length;
  const coord = isCoordinator(cwd, input.session_id);

  const lines = [
    `[seker-platform] Rol: ${coord ? 'KOORDİNATÖR' : 'işçi'} · oturum kimliği: ${input.session_id || '?'}`,
    `Worktree: ${top || cwd} · dal: ${branch || '?'}${behind && behind !== '0' ? ` · origin/main'in ${behind} commit gerisinde (son fetch'e göre)` : ''}${dirty ? ` · ${dirty} commit'siz değişiklik` : ''}`,
  ];
  if (!coord && branch === 'main') {
    lines.push("UYARI: İşçi oturum main üzerinde. İşe başlamadan main'den yeni dal + ayrı worktree aç.");
  }
  const ledger = join(ledgerDir(cwd), 'migrations.md');
  if (existsSync(ledger)) {
    const next = readFileSync(ledger, 'utf8').match(/Sıradaki boş numara:[^.\n]*/);
    lines.push(`Defter: ${ledger}${next ? ` · ${next[0].replace(/\*/g, '')}` : ''}`);
  }
  lines.push('Kurallar ve teslim şablonu: CLAUDE.md. Koordinatör kim: ListAgents + defter.');
  process.stdout.write(lines.join('\n') + '\n');
} catch {
  // Durum yazılamazsa oturum yine açılsın.
}
process.exit(0);
