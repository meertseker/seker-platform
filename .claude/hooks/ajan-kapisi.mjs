// PreToolUse: işçi oturumların main'e push, prod migration ve deploy yapmasını engeller.
// Koordinatör muaftır (bkz. ortak.mjs). Hook kendi hatasında engellemez (exit 0).
import { join } from 'node:path';
import { git, isCoordinator, ledgerDir, readStdin } from './ortak.mjs';

const WRITE_SQL = /\b(insert|update|delete|alter|create|drop|truncate|grant|revoke|comment\s+on)\b/i;

const BLOCKED_MCP = {
  mcp__supabase__apply_migration: 'prod migration uygulamak',
  mcp__supabase__deploy_edge_function: 'edge function yayınlamak',
  mcp__supabase__create_edge_function_secret: 'prod secret eklemek',
  mcp__supabase__merge_branch: 'Supabase dalını prod ile birleştirmek',
  mcp__supabase__reset_branch: 'Supabase dalını sıfırlamak',
};

// Komut zincirini (;, &&, ||, |, satır sonu) parçalara böler.
function segments(cmd) {
  return cmd.split(/\s*(?:&&|\|\||;|\||\r?\n)\s*/).filter(Boolean);
}

function gitPushToMain(seg, cwd) {
  const m = seg.match(/\bgit\b(.*?)\bpush\b(.*)$/);
  if (!m) return false;
  const args = m[2].trim().split(/\s+/).filter(Boolean);
  if (args.some((a) => a === '--all' || a === '--mirror')) return true;
  const positional = args.filter((a) => !a.startsWith('-'));
  const refspecs = positional.slice(1);
  if (refspecs.some((r) => /(^|:|\+)(refs\/heads\/)?(main|master)$/.test(r))) return true;
  if (refspecs.length === 0) {
    // Refspec yoksa git o anki dalı iter.
    const dir = m[1].match(/-C\s+("[^"]+"|'[^']+'|\S+)/)?.[1]?.replace(/^["']|["']$/g, '') || cwd;
    return git(dir, 'rev-parse', '--abbrev-ref', 'HEAD') === 'main';
  }
  return false;
}

function shellReason(cmd, cwd) {
  for (const seg of segments(cmd)) {
    if (gitPushToMain(seg, cwd)) return "main'e push etmek";
    if (/\bsupabase\b.*\bdb\s+push\b/.test(seg)) return '`supabase db push` ile prod migration';
    if (/\bsupabase\b.*\bdb\s+reset\b.*--linked\b/.test(seg)) return 'bağlı (prod) veritabanını sıfırlamak';
    if (/\bssh\b.*\b(deploy|rollback)\.sh\b/.test(seg)) return 'sunucuda deploy/rollback çalıştırmak';
    if (/\bgh\s+workflow\s+run\b/.test(seg)) return 'GitHub workflow tetiklemek';
    if (/\bvercel\b.*(--prod\b|\bpromote\b)/.test(seg)) return 'Vercel prod yayını';
  }
  return null;
}

function reasonFor(input) {
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};
  const cwd = input.cwd || process.cwd();
  if (tool === 'Bash' || tool === 'PowerShell') return shellReason(String(ti.command || ''), cwd);
  if (tool in BLOCKED_MCP) return BLOCKED_MCP[tool];
  if (tool === 'mcp__supabase__execute_sql' && WRITE_SQL.test(String(ti.query || ''))) {
    return "prod veritabanına yazan SQL çalıştırmak (okuma serbest)";
  }
  return null;
}

try {
  const input = readStdin();
  const reason = reasonFor(input);
  const cwd = input.cwd || process.cwd();
  if (reason && !isCoordinator(cwd, input.session_id)) {
    const file = join(ledgerDir(cwd), 'koordinator');
    process.stderr.write(
      `Engellendi: ${reason} yalnız koordinatör oturumun işi (CLAUDE.md > Roller).\n` +
        `İşçiysen: dalını commit'li bırak, koordinatöre SendMessage ile teslim et.\n` +
        `Mert bu oturumu koordinatör yaptıysa, şu satırı ${file} dosyasına ekle ve tekrar dene:\n` +
        `${input.session_id || '(oturum kimliği yok)'}\n`,
    );
    process.exit(2);
  }
} catch {
  // Hook hatası işi durdurmasın.
}
process.exit(0);
