/**
 * Personel giriş hesaplarını oluşturur (auth.users + public.profiles) — Supabase
 * Admin API ile. Yayın (prod) için: uygulama e-posta+şifre ile giriş yapar, roller
 * yönetici/danışman. VELİLER hesap ALMAZ (onlar lead'dir).
 *
 * Kullanım:
 *   # 1) out/staff.csv doldur (gitignore'da; gerçek e-posta içerir):
 *   #    full_name,email,role[,password]
 *   #    Mehtap Şeker,mehtap@okul.com,yonetici,
 *   #    Zehra Gürsel,zehra@okul.com,danisman,
 *   # 2) Prod ortam değişkenleriyle çalıştır:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
 *   npx tsx scripts/seed/create-staff.ts [--staff <path>] [--dry-run]
 *
 * Şifre boşsa güvenli geçici şifre üretilir ve KONSOLA basılır (bir kez dağıtılır,
 * kullanıcı ilk girişte değiştirmeli). Idempotent: e-postası zaten olan kullanıcı
 * atlanır (yalnız eksikse profili tamamlanır). Servis anahtarı asla loglanmaz.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import ws from "ws";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseCsv } from "./lib/csv";

(globalThis as unknown as { WebSocket: typeof ws }).WebSocket = ws;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.join(SCRIPT_DIR, "..", "..", ".env.local");
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });

const ROLES = new Set(["yonetici", "danisman"]);

function flag(name: string) {
  return process.argv.includes(name);
}
function value(name: string) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : null;
}

/** Okunur ama güçlü geçici şifre: 4 grup x 4 karakter (karışması zor alfabe). */
function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const pick = () =>
    Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  return `${pick()}-${pick()}-${pick()}`;
}

type StaffInput = { full_name: string; email: string; role: string; password: string };

function readStaff(csvPath: string): StaffInput[] {
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const out: StaffInput[] = [];
  for (const r of rows.slice(1)) {
    const full_name = (r[idx("full_name")] ?? "").trim();
    const email = (r[idx("email")] ?? "").trim().toLowerCase();
    const role = (r[idx("role")] ?? "").trim();
    const password = (r[idx("password")] ?? "").trim();
    if (!full_name && !email) continue; // boş satır
    out.push({ full_name, email, role, password });
  }
  return out;
}

async function existingEmailToId(db: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  // Admin API sayfalı; küçük ekip için birkaç sayfa yeterli ama yine de döngüyle tara.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`kullanıcı listesi alınamadı: ${error.message}`);
    for (const u of data.users) if (u.email) map.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
  }
  return map;
}

async function main() {
  const dryRun = flag("--dry-run");
  const staffPath = value("--staff") ?? path.join(SCRIPT_DIR, "out", "staff.csv");
  if (!fs.existsSync(staffPath)) {
    console.error(
      `staff CSV bulunamadı: ${staffPath}\n` +
        `Örnek başlık:  full_name,email,role,password\n` +
        `(role = yonetici | danisman; password boşsa üretilir)`,
    );
    process.exit(1);
  }

  const staff = readStaff(staffPath);
  const errors: string[] = [];
  staff.forEach((s, i) => {
    const line = i + 2;
    if (!s.full_name) errors.push(`satır ${line}: full_name boş`);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) errors.push(`satır ${line}: geçersiz e-posta "${s.email}"`);
    if (!ROLES.has(s.role)) errors.push(`satır ${line}: rol yonetici|danisman olmalı ("${s.role}")`);
  });
  if (errors.length) {
    console.error("Doğrulama hataları:\n  " + errors.join("\n  "));
    process.exit(1);
  }

  console.log("=== create-staff özet ===");
  console.log(`Mod: ${dryRun ? "DRY RUN (hiçbir hesap oluşturulmaz)" : "GERÇEK"}`);
  console.log(`Personel satırı: ${staff.length}`);
  staff.forEach((s) => console.log(`  ${s.role.padEnd(9)} ${s.full_name} <${s.email}>`));

  if (dryRun) {
    console.log("\nDry-run: hiçbir hesap oluşturulmadı.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
    process.exit(1);
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const existing = await existingEmailToId(db);
  const created: { email: string; password: string }[] = [];

  for (const s of staff) {
    let userId = existing.get(s.email);
    if (userId) {
      console.log(`• ${s.email}: kullanıcı zaten var, atlandı (profil kontrol ediliyor).`);
    } else {
      const password = s.password || tempPassword();
      const { data, error } = await db.auth.admin.createUser({
        email: s.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: s.full_name },
      });
      if (error) throw new Error(`auth kullanıcı oluşturulamadı (${s.email}): ${error.message}`);
      userId = data.user.id;
      created.push({ email: s.email, password });
      console.log(`• ${s.email}: hesap oluşturuldu.`);
    }

    // profiles satırı (id = auth user id). Varsa ad/rol güncellenir (upsert).
    const { error: pErr } = await db
      .from("profiles")
      .upsert({ id: userId, full_name: s.full_name, role: s.role }, { onConflict: "id" });
    if (pErr) throw new Error(`profil yazılamadı (${s.email}): ${pErr.message}`);
  }

  if (created.length) {
    console.log("\n=== YENİ GEÇİCİ ŞİFRELER (bir kez dağıtın, ilk girişte değiştirilsin) ===");
    for (const c of created) console.log(`  ${c.email}  →  ${c.password}`);
  }
  console.log(`\nTamam — oluşturulan: ${created.length}, zaten vardı: ${staff.length - created.length}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
