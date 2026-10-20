import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { isNotificationType } from "@/lib/notifications/types";

// Bildirim üreticilerinin kapsama bekçisi: her üretici tipli yardımcıdan
// (lib/notifications/insert.ts) geçmeli ve yazdığı tip kayıtta olmalı.

const PANEL = join(__dirname, "..", "..");
const MIGRATIONS = join(PANEL, "..", "..", "packages", "db", "supabase", "migrations");
const ALLOWED_RAW = join("lib", "notifications", "insert.ts");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}

const tsFiles = ["app", "actions", "lib", "components"]
  .flatMap((d) => walk(join(PANEL, d)))
  .filter((f) => /\.(ts|tsx)$/.test(f));

const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => relative(PANEL, f).split(sep).join("/");

/** `open` indeksindeki "(" için eşleşen ")" ile biten argüman metni. */
function callArgs(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) return src.slice(open + 1, i);
  }
  return src.slice(open + 1);
}

function tsTypes(): Set<string> {
  const found = new Set<string>();
  for (const f of tsFiles) {
    if (rel(f).startsWith("lib/notifications/insert.ts")) continue;
    const src = read(f);
    for (const m of src.matchAll(/\binsertNotifications\s*\(/g)) {
      const args = callArgs(src, m.index! + m[0].length - 1);
      for (const t of args.matchAll(/\btype:\s*"([a-z_]+)"/g)) found.add(t[1]);
    }
    for (const m of src.matchAll(/(?<!function\s)\bnotify\s*\(\s*[^,()]+,\s*[^,()]+,\s*(?:"([a-z_]+)"|([A-Za-z_]\w*))/g)) {
      if (m[1]) found.add(m[1]);
      else {
        const decl = src.match(new RegExp(String.raw`const\s+${m[2]}\s*=([^;]+);`));
        for (const t of decl?.[1].matchAll(/[?:]\s*"([a-z_]+)"/g) ?? []) found.add(t[1]);
      }
    }
  }
  return found;
}

function sqlTypes(): Set<string> {
  const found = new Set<string>();
  for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql"))) {
    const src = read(join(MIGRATIONS, name));
    for (const m of src.matchAll(/insert\s+into\s+public\.notifications[^;]*?;/gi)) {
      const stmt = m[0];
      const t =
        stmt.match(/\bselect\s+[\w.]+\s*,\s*'([a-z_]+)'/i) ??
        stmt.match(/\bvalues\s*\(\s*[^,]+,\s*'([a-z_]+)'/i);
      expect(t, `${name}: tip çıkarılamadı:\n${stmt}`).not.toBeNull();
      found.add(t![1]);
    }
  }
  return found;
}

describe("bildirim üreticileri", () => {
  it("ham notifications insert yalnızca lib/notifications/insert.ts içinde", () => {
    const offenders = tsFiles
      .filter((f) => rel(f) !== ALLOWED_RAW.split(sep).join("/"))
      .filter((f) => /\.from\(\s*["']notifications["']\s*\)\s*\.insert\s*\(/.test(read(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("SQL üreticileri kayıtlı tip yazar", () => {
    const types = sqlTypes();
    expect(types).toContain("web_basvuru");
    expect(types).toContain("geri_bildirim");
    for (const t of types) expect(isNotificationType(t), `SQL tipi kayıtsız: ${t}`).toBe(true);
  });

  it("TS üreticileri kayıtlı tip yazar", () => {
    const types = tsTypes();
    for (const k of [
      "randevu_bugun", "geciken_ozet", "veli_bekliyor", "ads_senkron_hata",
      "wa_baglanti_koptu", "teklif_onay_bekliyor", "teklifiniz_onaylandi", "teklif_reddedildi",
    ]) expect(types, `taranmadı: ${k}`).toContain(k);
    for (const t of types) expect(isNotificationType(t), `TS tipi kayıtsız: ${t}`).toBe(true);
  });
});
