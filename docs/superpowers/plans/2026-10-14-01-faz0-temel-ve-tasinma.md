# Faz 0: Temel ve Taşınma — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site ile CRM'i geçmişleriyle birlikte tek bir pnpm + Turborepo monorepo'suna taşımak, iki uygulamayı Next 16.2.12'de eşitlemek, CRM'i yeni Supabase anahtarlarına geçirmek ve her şeyi AWS Lightsail'deki tek sunucuda (Docker Compose + Caddy + cron + gece yedeği) yayına alıp Amplify ve Vercel'i kapatmak.

**Architecture:** `C:\Users\meert\Desktop\seker-platform` yeni git deposudur; `apps/web` (eski `react-kindergarten-site`) ve `apps/panel` (eski `annem/anaokulcrm`) `git subtree` ile geçmişleriyle gelir. Ortak kod üç küçük pakette durur (`@seker/shared`, `@seker/auth`, `@seker/db`) ve uygulamalara TypeScript kaynağı olarak `transpilePackages` ile girer. Her uygulama `output: 'standalone'` ile Docker imajına derlenir (GitHub Actions → GHCR); sunucuda Caddy HTTPS'i ve alan adlarını, küçük bir alpine `cron` konteyneri gece yedeğini ve panelin günlük işini yürütür.

**Tech Stack:** pnpm 10.11.1, Turborepo 2.11.x, Next.js 16.2.12, React 19.2, TypeScript 5, Vitest 4, `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.x, Supabase CLI (`npx supabase`), Docker 27, Caddy 2.10, alpine 3.22 (`postgresql17-client`, `aws-cli`, `tzdata`), GitHub Actions, AWS Lightsail (Ubuntu 24.04, Frankfurt), S3, IAM, Healthchecks.io, UptimeRobot.

**Spec:** `docs/superpowers/specs/2026-10-14-seker-platform-design.html` (bölümler: Mimari, Altyapı ve maliyet, Fazlar → Faz 0, Riskler). Ortak isimler: `docs/superpowers/plans/2026-10-14-00-seker-platform-index.md` ("Ortak Sözleşme"). Bu plan sözleşmedeki isimleri birebir kullanır.

## Global Constraints

İndeks dosyasındaki "Global Constraints" bölümünün tamamı bu plan için de geçerlidir. Faz 0'a özel olanlar:

- Next sürümü iki uygulamada da tam olarak `16.2.12`; `eslint-config-next` `16.2.12`. (16.2 hattının 2026-10-14 itibarıyla son yaması; `16.3+`'e bu fazda geçilmez.)
- Node ≥ 22 (`.nvmrc` = `22`), `packageManager: "pnpm@10.11.1"`.
- Lightsail: Frankfurt (`eu-central-1`), Linux/Unix, IPv4'lü 2 GB planı: **12 $/ay** (2 GB RAM, 2 vCPU, 60 GB SSD, 3 TB transfer; aws.amazon.com/lightsail/pricing, 2026-10-14'te kontrol edildi). Ubuntu 24.04 LTS.
- Supabase anahtarları yalnızca yeni biçim: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) ve `SUPABASE_SECRET_KEY` (`sb_secret_…`). Gizli anahtar tarayıcıdan çalışmaz (Supabase `User-Agent`'a bakıp 401 döner) ve JWT değildir.
- **İstisna (Faz 1'e kadar):** `apps/web/lib/supabase.ts` sitenin bugünkü *ayrı* başvuru veritabanına `SUPABASE_URL` + `SUPABASE_ANON_KEY` ile yazmaya devam eder; `ADMIN_PASSWORD` ve `/admin` de Faz 1'de kalkar. Faz 0 bu dosyalara dokunmaz.
- `NEXT_PUBLIC_*` değişkenleri Next derlemesinde koda gömülür; bu yüzden Docker imajı derlenirken `--build-arg` olarak verilir, çalışma anında değiştirilemez.
- Pano sırları tek dosyada: sunucuda `/opt/seker/.env` (izin `600`, sahibi `deploy`). Her konteyner bu dosyadan yalnızca kendine gereken değişkenleri `environment:` ile alır (`env_file` kullanılmaz; web paneli sırlarını görmez).
- Kişisel veri içeren dosyalar (WhatsApp dökümleri, `.xlsx`, `scripts/seed/out/`, `analysis/`, `veli-takip-analizi.html`, `Apollo_Local_Leads_Project_Brief.pdf`) hiçbir commit'e girmez.

## Review Focus

Spec'in ima ettiği ama hiçbir görevin olağan testinin yakalamadığı, kullanıcıyı en çok yakabilecek beş durum (en olası önce). Her biri için sabitleyici test/kontrol, sahibi olan göreve eklendi:

1. **Gece yedeği sessizce boş veya hiç alınmıyor** → yedek dosyası 10 KB'tan küçükse `backup.sh` hata verir ve Healthchecks.io'ya ping atmaz; Healthchecks 26 saat ping görmezse e-posta atar (Task 8, Task 10 Step 9). İlk geri yükleme denemesi bitmeden faz bitmiş sayılmaz (Task 8 Step 6).
2. **Panel oturum çerezi alan adı değişince kullanıcılar giriş yapamıyor / döngüye giriyor** → `authCookieOptions()` birim testi (Task 5) + staging'de gerçek hesapla giriş-çıkış-yeniden giriş kontrolü (Task 10 Step 7).
3. **`NEXT_PUBLIC_*` değeri imaja boş gömülüyor, panel üretimde Supabase'e bağlanamıyor** → Dockerfile'da build-arg boşsa derleme `test -n` ile durur (Task 7 Step 3); deploy betiği sağlık ucunu yoklamadan yeni sürümü kabul etmez (Task 9).
4. **Yeni sürüm bozuk çıkıyor ve canlı site düşüyor** → `deploy.sh` sağlık kontrolü başarısızsa bir önceki `IMAGE_TAG`'e kendiliğinden döner; `rollback.sh` elle dönüş (Task 9 Step 4, Task 10 Step 8'de bilerek bozuk etiketle denenir).
5. **DNS geçişinde form başvuruları kaybolur / iki sistem aynı anda cron çalıştırır** → geçişten bir gün önce TTL 300'e düşer, geçiş sonrası canlıdan test başvurusu gönderilir, Vercel'deki `CRON_SECRET` silinerek eski günlük iş etkisizleştirilir (Task 11).

---

## Dosya Haritası

**Yeni (monorepo kökü `C:\Users\meert\Desktop\seker-platform`):**
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.gitignore`, `.gitattributes`, `README.md`
- `packages/shared/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/phone.ts,src/env.ts,tests/phone.test.ts,tests/env.test.ts}`
- `packages/db/{package.json,tsconfig.json,src/index.ts,src/database.types.ts}` + `packages/db/supabase/` (panelden taşınır)
- `packages/auth/{package.json,tsconfig.json,vitest.config.ts,src/cookie.ts,src/server.ts,src/admin.ts,tests/cookie.test.ts,tests/admin.test.ts}`
- `apps/web/app/api/health/route.ts` + `apps/web/app/api/health/__tests__/route.test.ts`
- `apps/panel/app/api/health/route.ts` + `apps/panel/tests/unit/health-route.test.ts`
- `infra/Dockerfile.web`, `infra/Dockerfile.panel`, `infra/docker-compose.yml`, `infra/Caddyfile`, `infra/env.example`, `infra/deploy.sh`, `infra/rollback.sh`
- `infra/cron/{Dockerfile,crontab,entrypoint.sh,backup.sh}`
- `infra/aws/{media-bucket-policy.json,backup-lifecycle.json,iam-web-media.json,iam-backup.json}`
- `infra/server-setup.md`, `infra/restore.md`, `infra/cutover.md`
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Değişen:**
- `apps/web/package.json` (ad, Next 16, scriptler), `apps/web/next.config.ts`, `apps/web/eslint.config.mjs` (codemod), `apps/web/types/global.d.ts`, `apps/web/types/happy-dom.d.ts` (yeni), `apps/web/app/components/__tests__/CookieBanner.test.tsx`, `apps/web/lib/__tests__/schema.test.ts`, `apps/web/app/__tests__/homepage.test.tsx`, gerekirse `apps/web/app/components/cine/PageTransition.tsx`
- `apps/panel/package.json`, `apps/panel/next.config.ts`, `apps/panel/middleware.ts`, `apps/panel/lib/supabase/{server,admin,middleware}.ts`, `apps/panel/lib/phone.ts`, `apps/panel/app/api/cron/daily/route.ts`, `apps/panel/scripts/seed/{create-staff,inspect-db,migrate-production,sync-excel-payments,upload-aidat,upload}.ts`, `apps/panel/tests/rls/helpers.ts`, `apps/panel/vitest.config.ts`

**Silinen:** `apps/web/amplify.yml`, `apps/web/package-lock.json`, `apps/panel/package-lock.json`, `apps/panel/vercel.json`, `apps/panel/.vercelignore`, `apps/panel/supabase/` (→ `packages/db/supabase/`).

---

### Task 1: Bekleyen değişiklikleri güvenle commit et ve canlı formu kontrol et

**Files:**
- Modify (commit only): `C:\Users\meert\Desktop\sekeranaokuluweb\react-kindergarten-site\*` (dal `feat/website-reconstruction`), `C:\Users\meert\Desktop\annem\anaokulcrm\*`, `C:\Users\meert\Desktop\annem\docs\*` (dal `feature/anaokulcrm`)

**Interfaces:**
- Consumes: yok
- Produces: iki kaynak depoda temiz çalışma ağacı; Task 2 bu dalları `subtree` ile içe alır.

- [ ] **Step 1: Canlı formu test et (sahip yapar, 2 dk)**

https://sekeranaokulu.com/kayit adresinden ad "TEST Faz0", telefon `05000000000` ile form gönder. `LEAD_NOTIFICATION_EMAIL` kutusuna e-posta geldi mi, `/admin` listesinde kayıt var mı not et. Gelmediyse bu bir canlı arızadır (bkz. spec "Riskler": `amplify.yml` sırları `.env.production`'a yazmıyor); Faz 0 bunu sunucu taşınmasıyla çözer, ama sahibe hemen haber ver ve form bozuk kaldığı süre boyunca telefon/WhatsApp'ın öne çıktığını teyit et.

- [ ] **Step 2: Site deposundaki değişiklikleri gözden geçir**

```bash
cd /c/Users/meert/Desktop/sekeranaokuluweb/react-kindergarten-site
git status --short | wc -l
git status --short | grep -vE '^( M|M |A |\?\?) ' || true
git status --short -- photos public-originals-backup '*.log' '.env*'
```
Expected: ~83 satır; üçüncü komut **boş** çıkmalı (ham fotoğraflar, loglar, env dosyaları değişiklik listesinde olmamalı). Boş değilse o dosyaları `git add`'e dahil etme.

- [ ] **Step 3: Site değişikliklerini commit et**

```bash
git add -A -- . ':!photos' ':!*.log' ':!.env*'
git commit -m "chore: monorepo taşınması öncesi bekleyen site değişiklikleri"
git status --short | wc -l
```
Expected: son komut `0`.

- [ ] **Step 4: `public-originals-backup/` klasörünü git'ten çıkar**

Bu klasör sürüm takibinde ve lisanssız stok ile yüzü bulanıklaştırılmamış orijinaller içerebilir (`IMAGE-LICENSES.md`, `.gitignore`'daki `/photos/` notu). Yeni GitHub deposuna en azından güncel ağaçta girmesin:
```bash
git rm -r --cached public-originals-backup
printf '\n# Orijinal kopyalar yerelde kalır; depoya girmez.\n/public-originals-backup/\n' >> .gitignore
git add .gitignore
git commit -m "chore: orijinal görsel yedeklerini sürüm takibinden çıkar"
```
Not (sahibe iletilecek): klasör eski commit'lerde hâlâ var. `meertseker/react-kindergarten-site` deposu herkese açıksa Task 11 Step 8'de arşivlenip private yapılır.

- [ ] **Step 5: annem deposunu gözden geçir ve yalnızca kod/dokümanı commit et**

```bash
cd /c/Users/meert/Desktop/annem
git status --short
git add -- anaokulcrm docs/FABLE5-SEED-PROMPT.md docs/research .gitignore
git status --short -- anaokulcrm | grep -E 'whatsapp_export|\.xlsx|scripts/seed/out' || echo "kişisel veri yok"
git commit -m "chore: monorepo taşınması öncesi bekleyen CRM değişiklikleri"
git status --short
```
Expected: üçüncü komut `kişisel veri yok`. Son `git status` yalnızca `.claude/`, `Apollo_Local_Leads_Project_Brief.pdf`, `analysis/`, `veli-takip-analizi.html` gibi **izlenmeyen** dosyaları göstermeli; bunlar bilerek commit edilmez.

- [ ] **Step 6: Mevcut test tabanını kaydet**

```bash
cd /c/Users/meert/Desktop/sekeranaokuluweb/react-kindergarten-site && npx vitest run 2>&1 | tail -4
cd /c/Users/meert/Desktop/annem/anaokulcrm && npx vitest run tests/unit 2>&1 | tail -4
```
Expected: iki çıktıda da `Tests  N passed`. Sayıları not et (Task 2 Step 8'de karşılaştırılır).

---

### Task 2: Monorepo iskeleti ve iki projenin geçmişiyle içe alınması

**Files:**
- Create: `seker-platform/package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.gitignore`, `.gitattributes`, `README.md`
- Modify: `apps/web/package.json`, `apps/panel/package.json`
- Delete: `apps/web/package-lock.json`, `apps/panel/package-lock.json`, `apps/web/amplify.yml`, `apps/panel/vercel.json`, `apps/panel/.vercelignore`

**Interfaces:**
- Consumes: Task 1'deki dallar (`feat/website-reconstruction`, `feature/anaokulcrm`)
- Produces: workspace adları `@seker/web`, `@seker/panel`; her uygulamada `build`, `dev`, `start`, `lint`, `typecheck`, `test` scriptleri; kökte `pnpm turbo run <task>`.

- [ ] **Step 1: Depoyu başlat**

```bash
mkdir /c/Users/meert/Desktop/seker-platform && cd /c/Users/meert/Desktop/seker-platform
git init -b main
git commit --allow-empty -m "chore: monorepo başlangıcı"
```

- [ ] **Step 2: Siteyi geçmişiyle `apps/web`'e al**

```bash
git subtree add --prefix=apps/web /c/Users/meert/Desktop/sekeranaokuluweb/react-kindergarten-site feat/website-reconstruction
git log --oneline -- apps/web | wc -l
```
Expected: sayı > 50 (sitenin commit geçmişi geldi).

- [ ] **Step 3: CRM'i geçmişiyle `apps/panel`'e al**

```bash
cd /c/Users/meert/Desktop/annem
git subtree split --prefix=anaokulcrm -b panel-export
cd /c/Users/meert/Desktop/seker-platform
git subtree add --prefix=apps/panel /c/Users/meert/Desktop/annem panel-export
test -f apps/panel/middleware.ts && echo ok
```
Expected: `ok`.

- [ ] **Step 4: Eski dokümanları taşı**

```bash
mkdir -p docs/superpowers docs/legacy-crm
cp -r /c/Users/meert/Desktop/sekeranaokuluweb/docs/superpowers/. docs/superpowers/
cp -r /c/Users/meert/Desktop/annem/docs/. docs/legacy-crm/
ls docs/superpowers/plans | head
```
Expected: `2026-10-14-00-seker-platform-index.md` ve faz planları listede.

- [ ] **Step 5: Kök dosyalarını yaz**

`package.json`:
```json
{
  "name": "seker-platform",
  "private": true,
  "packageManager": "pnpm@10.11.1",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:start": "pnpm --filter @seker/db exec supabase start",
    "db:stop": "pnpm --filter @seker/db exec supabase stop"
  },
  "devDependencies": {
    "turbo": "2.11.8"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
onlyBuiltDependencies:
  - sharp
  - esbuild
  - supabase
  - unrs-resolver
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": ["NEXT_PUBLIC_*"],
      "outputs": [".next/**", "!.next/cache/**", "!.next/dev/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "typecheck": { "dependsOn": ["^typecheck"] },
    "test": {
      "env": ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"],
      "cache": false
    }
  }
}
```

`.nvmrc`:
```
22
```

`.gitignore`:
```gitignore
node_modules/
.turbo/
.next/
out/
coverage/
*.tsbuildinfo
next-env.d.ts
.env
.env.*
!.env.example
!infra/env.example
.vercel/
.DS_Store
*.log
# Kişisel veri — asla commit edilmez
apps/panel/scripts/seed/out/
**/whatsapp_export/
*.xlsx
apps/web/photos/
apps/web/public-originals-backup/
```

`.gitattributes` (Windows'ta yazılan kabuk betikleri Linux konteynerde CRLF yüzünden kırılmasın):
```gitattributes
* text=auto
*.sh text eol=lf
infra/cron/crontab text eol=lf
infra/Caddyfile text eol=lf
```

`README.md`:
```markdown
# Şeker Okul Platformu

- `apps/web` — sekeranaokulu.com (Next.js 16)
- `apps/panel` — panel.sekeranaokulu.com (Next.js 16, eski anaokulcrm)
- `packages/*` — ortak kod (`@seker/shared`, `@seker/auth`, `@seker/db`)
- `infra/` — Docker Compose, Caddy, cron, sunucu kurulumu

Yerel çalıştırma: `pnpm install`, `pnpm db:start`, `pnpm dev`.
Plan ve spec: `docs/superpowers/`.
```

- [ ] **Step 6: Uygulama paket adlarını ve scriptlerini düzenle, eski platform dosyalarını sil**

`apps/web/package.json` içinde: `"name": "@seker/web"`, `scripts` bloğunu şununla değiştir (`next lint` Next 16'da yok; codemod Task 6'da eslint yapılandırmasını da günceller):
```json
"scripts": {
  "dev": "next dev --port 3000",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```
`"engines"` alanını `{ "node": ">=22" }` yap.

`apps/panel/package.json` içinde: `"name": "@seker/panel"`, `scripts`:
```json
"scripts": {
  "dev": "next dev --port 3001",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```
Sonra:
```bash
git rm -q apps/web/package-lock.json apps/panel/package-lock.json apps/web/amplify.yml apps/panel/vercel.json apps/panel/.vercelignore
rm -rf apps/web/.vercel apps/panel/.vercel apps/web/node_modules apps/panel/node_modules
```

- [ ] **Step 7: Kur**

```bash
corepack enable
pnpm install
```
Expected: `pnpm-lock.yaml` oluşur, hata yok. `ERR_PNPM_PEER_DEP_ISSUES` uyarısı çıkarsa uyarıdır, hata değil.

- [ ] **Step 8: Taban testleri monorepo içinde çalıştır**

```bash
pnpm --filter @seker/web test 2>&1 | tail -4
pnpm --filter @seker/panel exec vitest run tests/unit 2>&1 | tail -4
```
Expected: Task 1 Step 6'daki sayılarla aynı `passed` adedi. Farklıysa bağımlılık çözümü değişmiştir: `pnpm why <paket>` ile npm kilidindeki sürüme karşı farkı bul ve `package.json`'da o sürüme sabitle.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: pnpm + turborepo monorepo; site ve CRM geçmişiyle içe alındı"
```

---

### Task 3: `@seker/shared` — telefon normalizasyonu ve env yardımcısı

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`, `packages/shared/src/index.ts`, `packages/shared/src/phone.ts`, `packages/shared/src/env.ts`, `packages/shared/tests/phone.test.ts`, `packages/shared/tests/env.test.ts`
- Modify: `apps/panel/lib/phone.ts`, `apps/panel/package.json`

**Interfaces:**
- Consumes: yok
- Produces: `normalizeTurkishPhone(raw: string): string | null` (`@seker/shared` ve `@seker/shared/phone`), `requireEnv(name: string): string` (`@seker/shared/env`). Faz 1 site formu `normalizeTurkishPhone`'u buradan alır.

- [ ] **Step 1: Paket iskeleti**

`packages/shared/package.json`:
```json
{
  "name": "@seker/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./phone": "./src/phone.ts",
    "./env": "./src/env.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```
`packages/shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```
`packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```
`pnpm --filter @seker/shared add -D @types/node@^22` çalıştır.

- [ ] **Step 2: Failing testleri yaz**

`packages/shared/tests/phone.test.ts` (panelin bugünkü testinin aynısı, import yolu değişti):
```ts
import { describe, it, expect } from 'vitest';
import { normalizeTurkishPhone } from '../src/phone';

describe('normalizeTurkishPhone', () => {
  it.each([
    ['0536 656 33 96', '+905366563396'],
    ['+90 534 034 44 46', '+905340344446'],
    ['05315248234', '+905315248234'],
    ['90 541 977 66 21', '+905419776621'],
    ['5366563396', '+905366563396'],
    ['(0536) 656-33-96', '+905366563396'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeTurkishPhone(raw)).toBe(expected);
  });

  it.each([['123'], ['02123456789'], [''], ['+4915112345678'], ['0000000000']])(
    'geçersiz: %s -> null',
    (raw) => expect(normalizeTurkishPhone(raw)).toBeNull(),
  );
});
```
`packages/shared/tests/env.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireEnv } from '../src/env';

describe('requireEnv', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('tanımlı değeri döner', () => {
    vi.stubEnv('SEKER_TEST_VAR', 'deger');
    expect(requireEnv('SEKER_TEST_VAR')).toBe('deger');
  });

  it('boş veya tanımsızsa adıyla hata fırlatır', () => {
    vi.stubEnv('SEKER_TEST_VAR', '');
    expect(() => requireEnv('SEKER_TEST_VAR')).toThrow('Eksik ortam değişkeni: SEKER_TEST_VAR');
  });
});
```

- [ ] **Step 3: Testin düştüğünü gör**

Run: `pnpm --filter @seker/shared test`
Expected: FAIL — `Failed to resolve import "../src/phone"`.

- [ ] **Step 4: Uygula**

`packages/shared/src/phone.ts` (davranış `apps/panel/lib/phone.ts` ile birebir aynı):
```ts
/** Türk cep telefonunu E.164'e normalize eder. Geçersizse null. */
export function normalizeTurkishPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let rest: string;
  if (digits.startsWith('0090')) rest = digits.slice(4);
  else if (digits.startsWith('90') && digits.length === 12) rest = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) rest = digits.slice(1);
  else if (digits.length === 10) rest = digits;
  else return null;
  if (rest.length !== 10 || !rest.startsWith('5')) return null;
  return `+90${rest}`;
}
```
`packages/shared/src/env.ts`:
```ts
/** Sunucu tarafında zorunlu bir ortam değişkenini okur; yoksa açık bir hatayla durur. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Eksik ortam değişkeni: ${name}`);
  return value;
}
```
`packages/shared/src/index.ts`:
```ts
export { normalizeTurkishPhone } from './phone';
export { requireEnv } from './env';
```

- [ ] **Step 5: Testlerin geçtiğini gör**

Run: `pnpm --filter @seker/shared test`
Expected: PASS, 13 test.

- [ ] **Step 6: Panelin `lib/phone.ts`'ini yeniden dışa aktarmaya çevir**

`pnpm --filter @seker/panel add @seker/shared@workspace:*` çalıştır. `apps/panel/lib/phone.ts` içeriğinin tamamını şununla değiştir:
```ts
export { normalizeTurkishPhone } from "@seker/shared/phone";
```
`apps/panel/next.config.ts` henüz Task 7'de düzenlenecek; testler için Vite workspace paketlerini kaynak olarak çözer.

Run: `pnpm --filter @seker/panel exec vitest run tests/unit/phone.test.ts tests/seed/phone-recovery.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared apps/panel/lib/phone.ts apps/panel/package.json pnpm-lock.yaml
git commit -m "feat(shared): telefon normalizasyonu ve requireEnv ortak pakete taşındı"
```

---

### Task 4: `@seker/db` — Supabase klasörünün taşınması ve üretilmiş tipler

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/index.ts`, `packages/db/src/database.types.ts` (üretilir)
- Move: `apps/panel/supabase/` → `packages/db/supabase/`

**Interfaces:**
- Consumes: yok
- Produces: `import type { Database } from '@seker/db'`; scriptler `pnpm --filter @seker/db gen:types`, `pnpm db:start`. Sonraki fazların migration'ları `packages/db/supabase/migrations/NNNN_ad.sql`.

- [ ] **Step 1: Klasörü taşı**

```bash
mkdir -p packages/db/src
git mv apps/panel/supabase packages/db/supabase
ls packages/db/supabase/migrations
```
Expected: `0001_schema.sql` … `0005_kitap_item_type.sql`.

- [ ] **Step 2: Paket dosyaları**

`packages/db/package.json`:
```json
{
  "name": "@seker/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "gen:types": "supabase gen types typescript --local --schema public > src/database.types.ts"
  },
  "devDependencies": {
    "supabase": "2.121.0",
    "typescript": "^5"
  }
}
```
`packages/db/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```
`packages/db/src/index.ts`:
```ts
export type { Database, Json } from './database.types';
```

- [ ] **Step 3: Yerel Supabase'i başlat ve tipleri üret**

```bash
pnpm install
pnpm db:start
pnpm --filter @seker/db gen:types
grep -c "leads:" packages/db/src/database.types.ts
```
Expected: `supabase start` sonunda "Authentication Keys" altında **Publishable** ve **Secret** anahtarları yazar; son komut `1` veya daha büyük. (Docker Desktop açık olmalı.)

- [ ] **Step 4: Panelin yerel `.env.local`'ini yeni anahtar adlarına çevir**

`pnpm --filter @seker/db exec supabase status` çıktısından değerleri al ve `apps/panel/.env.local`'i şu biçime getir (git'e girmez):
```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<status çıktısındaki Publishable key, sb_publishable_ ile başlar>
SUPABASE_SECRET_KEY=<status çıktısındaki Secret key, sb_secret_ ile başlar>
CRON_SECRET=local-cron-secret
AUTH_COOKIE_DOMAIN=
```

- [ ] **Step 5: Typecheck ve commit**

Run: `pnpm --filter @seker/db typecheck`
Expected: çıktı yok, exit 0.
```bash
git add packages/db apps/panel pnpm-lock.yaml
git commit -m "feat(db): supabase migration'ları ve üretilmiş tipler @seker/db paketine taşındı"
```

---

### Task 5: `@seker/auth` ve panelin yeni Supabase anahtarlarına geçişi

**Files:**
- Create: `packages/auth/package.json`, `packages/auth/tsconfig.json`, `packages/auth/vitest.config.ts`, `packages/auth/src/cookie.ts`, `packages/auth/src/server.ts`, `packages/auth/src/admin.ts`, `packages/auth/tests/cookie.test.ts`, `packages/auth/tests/admin.test.ts`
- Modify: `apps/panel/lib/supabase/server.ts`, `apps/panel/lib/supabase/admin.ts`, `apps/panel/lib/supabase/middleware.ts`, `apps/panel/app/api/cron/daily/route.ts`, `apps/panel/scripts/seed/create-staff.ts`, `apps/panel/scripts/seed/inspect-db.ts`, `apps/panel/scripts/seed/migrate-production.ts`, `apps/panel/scripts/seed/sync-excel-payments.ts`, `apps/panel/scripts/seed/upload-aidat.ts`, `apps/panel/scripts/seed/upload.ts`, `apps/panel/tests/rls/helpers.ts`, `apps/panel/package.json`

**Interfaces:**
- Consumes: `Database` (`@seker/db`, Task 4), `requireEnv` (`@seker/shared/env`, Task 3)
- Produces (sözleşmedeki imzalar):
  - `authCookieOptions(): CookieOptionsWithName` — `@seker/auth/cookie`
  - `createServerSupabase(): Promise<SupabaseClient<Database>>` — `@seker/auth/server`
  - `createAdminSupabase(): SupabaseClient<Database>` — `@seker/auth/admin` (yalnızca sunucu)
  - `getEditor()` sözleşmede bu pakette ama `profiles.can_edit_site` kolonuna bağlı olduğu için **Faz 2'de** `packages/auth/src/editor.ts` olarak eklenir.

- [ ] **Step 1: Paket iskeleti**

`packages/auth/package.json`:
```json
{
  "name": "@seker/auth",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./cookie": "./src/cookie.ts",
    "./server": "./src/server.ts",
    "./admin": "./src/admin.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@seker/db": "workspace:*",
    "@seker/shared": "workspace:*",
    "@supabase/ssr": "0.12.7",
    "@supabase/supabase-js": "2.117.3",
    "server-only": "0.0.1"
  },
  "peerDependencies": {
    "next": "16.2.12"
  },
  "devDependencies": {
    "@types/node": "^22",
    "next": "16.2.12",
    "typescript": "^5",
    "vitest": "^4.1.10"
  }
}
```
`packages/auth/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```
`packages/auth/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```
Run: `pnpm install`

- [ ] **Step 2: Failing testleri yaz**

`packages/auth/tests/cookie.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authCookieOptions } from '../src/cookie';

describe('authCookieOptions', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('üretimde ortak alan adına ve secure çereze yazar', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', '.sekeranaokulu.com');
    vi.stubEnv('NODE_ENV', 'production');
    expect(authCookieOptions()).toEqual({
      domain: '.sekeranaokulu.com',
      path: '/',
      sameSite: 'lax',
      secure: true,
    });
  });

  it('AUTH_COOKIE_DOMAIN boşsa host-only çerez kullanır (localhost)', () => {
    vi.stubEnv('AUTH_COOKIE_DOMAIN', '');
    vi.stubEnv('NODE_ENV', 'development');
    const options = authCookieOptions();
    expect(options.domain).toBeUndefined();
    expect(options.secure).toBe(false);
  });
});
```
`packages/auth/tests/admin.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('createAdminSupabase', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('gizli anahtar yoksa açık hata verir', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    const { createAdminSupabase } = await import('../src/admin');
    expect(() => createAdminSupabase()).toThrow('Eksik ortam değişkeni: SUPABASE_SECRET_KEY');
  });

  it('URL ve gizli anahtarla istemci döner', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
    const { createAdminSupabase } = await import('../src/admin');
    expect(typeof createAdminSupabase().from).toBe('function');
  });
});
```

- [ ] **Step 3: Testin düştüğünü gör**

Run: `pnpm --filter @seker/auth test`
Expected: FAIL — `Failed to resolve import "../src/cookie"`.

- [ ] **Step 4: Uygula**

`packages/auth/src/cookie.ts`:
```ts
import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * Site ve panel aynı Supabase oturumunu paylaşsın diye çerez ortak üst alan
 * adına (.sekeranaokulu.com) yazılır. Yerelde boş bırakılır: localhost'ta
 * domain'li çerez tarayıcı tarafından reddedilir.
 */
export function authCookieOptions(): CookieOptionsWithName {
  return {
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}
```
`packages/auth/src/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@seker/db';
import { authCookieOptions } from './cookie';

/** İstek başına yeni istemci; kullanıcının oturumuyla (RLS uygulanır) çalışır. */
export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Eksik ortam değişkeni: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component içinden çağrıldıysa çerezi middleware yeniler.
        }
      },
    },
  });
}
```
`packages/auth/src/admin.ts`:
```ts
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@seker/db';
import { requireEnv } from '@seker/shared/env';

/** RLS'i aşan sunucu istemcisi. Yalnızca sunucu kodunda, kullanıcı girdisini doğruladıktan sonra. */
export function createAdminSupabase(): SupabaseClient<Database> {
  return createClient<Database>(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 5: Testlerin geçtiğini gör**

Run: `pnpm --filter @seker/auth test && pnpm --filter @seker/auth typecheck`
Expected: PASS (4 test), typecheck çıktısız.

- [ ] **Step 6: Panel sarmalayıcılarını `@seker/auth`'a bağla**

`pnpm --filter @seker/panel add @seker/auth@workspace:* @seker/db@workspace:*`

`apps/panel/lib/supabase/server.ts` içeriğinin tamamı:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase as createTypedServerSupabase } from "@seker/auth/server";

/**
 * Panelin mevcut 128 sorgusu henüz Database tipine göre yazılmadı; tipsiz
 * istemci döndürmek davranışı değiştirmez. Yeni kod @seker/auth/server'ı
 * doğrudan (tipli) kullanır.
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  return (await createTypedServerSupabase()) as unknown as SupabaseClient;
}
```
`apps/panel/lib/supabase/admin.ts` içeriğinin tamamı:
```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase as createTypedAdminSupabase } from "@seker/auth/admin";

export function createAdminSupabase(): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return null;
  return createTypedAdminSupabase() as unknown as SupabaseClient;
}
```
`apps/panel/lib/supabase/middleware.ts` içinde (`updateSession`): dosyanın başına `import { authCookieOptions } from "@seker/auth/cookie";` ekle ve `createServerClient(...)` çağrısının ilk üç argümanını şu hale getir (cookies bloğu aynen kalır):
```ts
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: authCookieOptions(),
      cookies: {
```
(Dosya Task 1'de commit edilen yerel değişiklikleri içeriyor; yalnızca bu satırlara dokun.)

- [ ] **Step 7: Kalan anahtar adlarını değiştir**

```bash
cd apps/panel
sed -i 's/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY/g; s/NEXT_PUBLIC_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/g' \
  app/api/cron/daily/route.ts scripts/seed/create-staff.ts scripts/seed/inspect-db.ts scripts/seed/migrate-production.ts \
  scripts/seed/sync-excel-payments.ts scripts/seed/upload-aidat.ts scripts/seed/upload.ts tests/rls/helpers.ts
sed -i 's/service_role_key/secret_key/g' scripts/seed/create-staff.ts
cd ../..
grep -rnE "SERVICE_ROLE|ANON_KEY" apps/panel --include=*.ts --include=*.tsx --include=*.md -l | grep -v node_modules || echo "temiz"
```
Expected: `temiz`. (README/CLAUDE.md gibi doküman eşleşirse orada da aynı değişikliği yap.)

- [ ] **Step 8: Panel testlerinin tamamını yerel Supabase'e karşı çalıştır**

`apps/panel/vitest.config.ts`'te `include`'u değiştirme; `tests/rls` yerel Supabase ister (`pnpm db:start` çalışıyor olmalı).
Run: `pnpm --filter @seker/panel test 2>&1 | tail -6 && pnpm --filter @seker/panel typecheck`
Expected: tüm testler PASS (RLS testleri dahil, yeni publishable anahtarla `signInWithPassword` çalışır); typecheck çıktısız.

- [ ] **Step 9: Panelde girişi elle doğrula**

```bash
pnpm --filter @seker/panel dev
```
http://localhost:3001/login → `yonetici@test.local` / `sifre123` ile giriş → `/pipeline` açılmalı; çıkış yap, tekrar giriş yap. Tarayıcı geliştirici araçlarında `sb-127-auth-token` çerezinin `Domain` alanı `localhost` olmalı.

- [ ] **Step 10: Commit**

```bash
git add packages/auth apps/panel pnpm-lock.yaml
git commit -m "feat(auth): ortak supabase istemcileri; panel yeni publishable/secret anahtarlarına geçti"
```

---

### Task 6: Sitenin Next 16.2.12'ye yükseltilmesi

**Files:**
- Modify: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/eslint.config.mjs`, `apps/web/types/global.d.ts`, `apps/web/app/components/__tests__/CookieBanner.test.tsx`, `apps/web/lib/__tests__/schema.test.ts`, `apps/web/app/__tests__/homepage.test.tsx`; koşullu: `apps/web/app/components/cine/PageTransition.tsx`
- Create: `apps/web/types/happy-dom.d.ts`
- Modify: `apps/panel/package.json` (16.2.10 → 16.2.12)

**Interfaces:**
- Consumes: yok
- Produces: iki uygulama da `next@16.2.12`; `pnpm --filter @seker/web typecheck` sıfır hatayla geçer (CI Task 9 buna dayanır).

- [ ] **Step 1: Mevcut tip hatalarını düzelt (yükseltmeden önce, 7 hata)**

Bugün `tsc --noEmit` sitede 7 hata veriyor (hepsi testlerde). CI'ı yeşil başlatmak için önce bunları kapat.

`apps/web/types/happy-dom.d.ts` (yeni):
```ts
export {};

// Vitest happy-dom ortamı window'a happyDOM ekler; testler URL'yi bununla değiştirir.
declare global {
  interface Window {
    happyDOM: { setURL(url: string): void };
  }
}
```
`apps/web/app/components/__tests__/CookieBanner.test.tsx` içinde `window.gtag = gtag;` satırını şununla değiştir:
```ts
    window.gtag = gtag as unknown as (...args: unknown[]) => void;
```
`apps/web/lib/__tests__/schema.test.ts` içinde `buildFaqSchema([...])` çağrısındaki nesneyi şununla değiştir:
```ts
      { id: 'a', question: 'Kaç yaş?', answer: '2-6 yaş.', featured: true, ready: true },
```
`apps/web/app/__tests__/homepage.test.tsx` içinde `if (MEDIA[key].status !== 'stok') continue;` satırını şununla değiştir (bugün hiçbir medya 'stok' olmadığı için TS karşılaştırmayı gereksiz buluyor; test gelecekte eklenecek stok görsellere karşı koruma):
```ts
      if ((MEDIA[key].status as string) !== 'stok') continue;
```
Run: `pnpm --filter @seker/web typecheck`
Expected: çıktı yok, exit 0.

- [ ] **Step 2: Upgrade codemod'u çalıştır**

```bash
cd apps/web
pnpm dlx @next/codemod@canary upgrade 16.2.12
cd ../..
```
Codemod sorarsa: Turbopack'e geçişi kabul et (sitede özel `webpack` yapılandırması yok), `next lint` → ESLint CLI geçişini kabul et. Sonra `apps/web/package.json`'da şunları doğrula/elle düzelt: `"next": "16.2.12"`, `"eslint-config-next": "16.2.12"`, `"react"` ve `"react-dom"` `^19.2.0`, `@types/react` ve `@types/react-dom` `^19.2.0`, `"sharp"` **`dependencies`** altında (standalone imajda resim optimizasyonu için gerekli; bugün devDependency). `scripts.lint` `eslint .` kalmalı.

- [ ] **Step 3: ESLint yapılandırmasını flat config'e çevir**

Codemod `apps/web/eslint.config.mjs`'i değiştirmediyse içeriğini panelinkiyle aynı biçime getir:
```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public-originals-backup/**", "photos/**"]),
]);

export default eslintConfig;
```
`pnpm --filter @seker/web remove @eslint/eslintrc` çalıştır.
Run: `pnpm --filter @seker/web lint`
Expected: exit 0 (uyarılar kabul; hata varsa yalnızca yeni kuralların bulduğu gerçek hataları düzelt).

- [ ] **Step 4: Paneli aynı yamaya çek**

`apps/panel/package.json`: `"next": "16.2.12"`, `"eslint-config-next": "16.2.12"`. Sonra `pnpm install`.

- [ ] **Step 5: Typecheck, test, build**

```bash
pnpm --filter @seker/web typecheck
pnpm --filter @seker/web test 2>&1 | tail -4
pnpm --filter @seker/web build 2>&1 | tail -25
```
Expected: typecheck çıktısız; testler Task 1 Step 6'daki sayıyla PASS; build başarılı, rota listesinde `/lp/[slug]` beş sayfayla `●` (SSG) görünür.

Koşullu düzeltme — typecheck veya build `unstable_ViewTransition` ile ilgili hata verirse, `apps/web/app/components/cine/PageTransition.tsx`'teki import satırını şununla değiştir ve Step 5'i tekrarla:
```tsx
import { ViewTransition } from 'react'
```
(`next.config.ts`'teki `experimental.viewTransition: true` Next 16'da hâlâ geçerli; kaldırma.)

- [ ] **Step 6: Görsel kontrol**

```bash
pnpm --filter @seker/web build && pnpm --filter @seker/web start
```
http://localhost:3000, `/kayit`, `/lp/beylikduzu-anaokulu`, `/aktiviteler` sayfalarını aç: fotoğraflar yükleniyor, sayfa geçişleri çalışıyor, konsolda hata yok. Next 16'nın yeni varsayılanları (`images.qualities: [75]`, `minimumCacheTTL` 4 saat) sitede `quality=` kullanılmadığı için davranışı değiştirmez.

- [ ] **Step 7: Commit**

```bash
git add apps/web apps/panel/package.json pnpm-lock.yaml
git commit -m "chore(web): Next 16.2.12 yükseltmesi, eslint flat config, test tip hataları giderildi"
```

---

### Task 7: Sağlık uçları, standalone çıktı ve Docker imajları

**Files:**
- Create: `apps/web/app/api/health/route.ts`, `apps/web/app/api/health/__tests__/route.test.ts`, `apps/panel/app/api/health/route.ts`, `apps/panel/tests/unit/health-route.test.ts`, `infra/Dockerfile.web`, `infra/Dockerfile.panel`, `.dockerignore`
- Modify: `apps/web/next.config.ts`, `apps/panel/next.config.ts`, `apps/panel/middleware.ts`

**Interfaces:**
- Consumes: `createAdminSupabase` (`@seker/auth/admin`)
- Produces: `GET /api/health` → web: `{ ok: true }`; panel: `{ ok: true }` veya 503 `{ ok: false }`. İmajlar `ghcr.io/<owner>/seker-web:<sha>`, `ghcr.io/<owner>/seker-panel:<sha>`, ikisi de port 3000, `node apps/<app>/server.js`.

- [ ] **Step 1: Failing sağlık testleri**

`apps/web/app/api/health/__tests__/route.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { GET } from '../route';

describe('GET /api/health', () => {
  it('veritabanına dokunmadan ok döner', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
```
`apps/panel/tests/unit/health-route.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn();
vi.mock("@seker/auth/admin", () => ({
  createAdminSupabase: () => ({
    from: () => ({ select: () => ({ limit }) }),
  }),
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health (panel)", () => {
  beforeEach(() => limit.mockReset());

  it("veritabanı cevap verirse 200", async () => {
    limit.mockResolvedValue({ data: [{ key: "takipsizlik_gun" }], error: null });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("veritabanı hata verirse 503", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "paused" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Düştüğünü gör**

Run: `pnpm --filter @seker/web exec vitest run app/api/health && pnpm --filter @seker/panel exec vitest run tests/unit/health-route.test.ts`
Expected: FAIL — `Failed to resolve import "../route"` / `"@/app/api/health/route"`.

- [ ] **Step 3: Uçları uygula**

`apps/web/app/api/health/route.ts`:
```ts
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true });
}
```
`apps/panel/app/api/health/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createAdminSupabase } from "@seker/auth/admin";

export const dynamic = "force-dynamic";

/** Uptime izleme her 5 dakikada çağırır: hem DB'yi kontrol eder hem Supabase Free'yi aktif tutar. */
export async function GET() {
  const { error } = await createAdminSupabase().from("app_settings").select("key").limit(1);
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true });
}
```
`apps/panel/middleware.ts` içindeki matcher'a `api/health`'i ekle:
```ts
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/cron|api/health|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
```

- [ ] **Step 4: Geçtiğini gör**

Run: Step 2'deki komut.
Expected: PASS (1 + 2 test).

- [ ] **Step 5: Standalone ve workspace ayarları**

`apps/web/next.config.ts` (tamamı):
```ts
import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.resolve(process.cwd(), '../..');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  transpilePackages: ['@seker/auth', '@seker/shared', '@seker/db'],
  experimental: {
    viewTransition: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      {
        source: '/ucretler',
        destination: '/kayit',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
```
`apps/panel/next.config.ts` (tamamı):
```ts
import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  transpilePackages: ["@seker/auth", "@seker/shared", "@seker/db"],
};

export default nextConfig;
```
Run: `pnpm turbo run build --filter=@seker/web --filter=@seker/panel && ls apps/web/.next/standalone/apps/web/server.js apps/panel/.next/standalone/apps/panel/server.js`
Expected: iki `server.js` yolu listelenir. (Panel build'i için `apps/panel/.env.local` yerel değerleri yeterli.)

- [ ] **Step 6: `.dockerignore`**

Kökte `.dockerignore`:
```
**/node_modules
**/.next
**/.turbo
**/.env
**/.env.*
.git
apps/web/photos
apps/web/public-originals-backup
apps/panel/scripts/seed/out
docs
```

- [ ] **Step 7: Dockerfile'lar**

`infra/Dockerfile.web`:
```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN corepack pnpm dlx turbo@2.11.8 prune @seker/web --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
ARG NEXT_PUBLIC_GTM_ID
ENV NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@seker/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public
RUN mkdir -p apps/web/.next/cache && chown -R nextjs:nodejs apps/web/.next/cache
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]
```
`infra/Dockerfile.panel`:
```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN corepack pnpm dlx turbo@2.11.8 prune @seker/panel --docker

FROM base AS builder
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" && test -n "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  || (echo "NEXT_PUBLIC_SUPABASE_* build-arg eksik" >&2; exit 1)
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@seker/panel

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /repo/apps/panel/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/panel/.next/static ./apps/panel/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/panel/public ./apps/panel/public
RUN mkdir -p apps/panel/.next/cache && chown -R nextjs:nodejs apps/panel/.next/cache
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/panel/server.js"]
```

- [ ] **Step 8: İmajları yerelde derle ve çalıştır**

```bash
docker build -f infra/Dockerfile.web --build-arg NEXT_PUBLIC_GTM_ID= -t seker-web:local .
docker run --rm -d -p 3100:3000 --name seker-web-test seker-web:local
sleep 5; curl -s http://localhost:3100/api/health; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3100/_next/image?url=%2Fimages%2Fhero.jpg&w=640&q=75"
docker stop seker-web-test
```
Expected: `{"ok":true}`, `200`, son satır `200` veya `404` (dosya adı farklıysa) — **`500` olmamalı**; 500 sharp'ın imajda olmadığını gösterir (sharp'ın `dependencies`'te olduğunu kontrol et). `public/` altındaki gerçek bir görsel adını `ls apps/web/public` ile seç.

```bash
docker build -f infra/Dockerfile.panel --build-arg NEXT_PUBLIC_SUPABASE_URL=http://host.docker.internal:54321 \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(grep PUBLISHABLE apps/panel/.env.local | cut -d= -f2)" -t seker-panel:local .
docker run --rm -d -p 3101:3000 -e SUPABASE_SECRET_KEY="$(grep SECRET_KEY apps/panel/.env.local | cut -d= -f2)" --name seker-panel-test seker-panel:local
sleep 5; curl -s http://localhost:3101/api/health; docker stop seker-panel-test
docker build -f infra/Dockerfile.panel -t seker-panel:noarg . 2>&1 | grep -c "build-arg eksik"
```
Expected: `{"ok":true}`; son komut `1` (build-arg verilmezse derleme durur).

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/api/health apps/panel/app/api/health apps/panel/tests/unit/health-route.test.ts apps/panel/middleware.ts apps/web/next.config.ts apps/panel/next.config.ts infra/Dockerfile.web infra/Dockerfile.panel .dockerignore
git commit -m "feat(infra): sağlık uçları, standalone çıktı ve çok aşamalı Docker imajları"
```

---

### Task 8: Docker Compose, Caddy, cron konteyneri, gece yedeği ve geri yükleme

**Files:**
- Create: `infra/docker-compose.yml`, `infra/Caddyfile`, `infra/env.example`, `infra/cron/Dockerfile`, `infra/cron/crontab`, `infra/cron/entrypoint.sh`, `infra/cron/backup.sh`, `infra/restore.md`

**Interfaces:**
- Consumes: Task 7 imajları; panelin `GET /api/cron/daily` (header `Authorization: Bearer $CRON_SECRET`)
- Produces: servis adları `caddy`, `web`, `panel`, `cron` (iç ağda `http://web:3000`, `http://panel:3000`); `/opt/seker/.env` anahtarları (`infra/env.example`); S3 yedek anahtarı biçimi `db/YYYY-MM-DDTHHMM.dump`. Faz 3 crontab'a `0 6 * * *` satırını ekler.

- [ ] **Step 1: `infra/env.example`**

```dotenv
# /opt/seker/.env — sahibi deploy, chmod 600. Bu dosya git'e girmez; yalnızca bu örnek girer.
# --- compose ---
GHCR_OWNER=meertseker
IMAGE_TAG=
SITE_HOST=sekeranaokulu.com
PANEL_HOST=panel.sekeranaokulu.com
ACME_EMAIL=meertseker@gmail.com

# --- ortak ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
AUTH_COOKIE_DOMAIN=.sekeranaokulu.com
SITE_URL=https://sekeranaokulu.com
PANEL_URL=https://panel.sekeranaokulu.com
CRON_SECRET=

# --- web (Faz 0: eski başvuru veritabanı; Faz 1'de kalkar) ---
SUPABASE_URL=
SUPABASE_ANON_KEY=
ADMIN_PASSWORD=
RESEND_API_KEY=
LEAD_NOTIFICATION_EMAIL=sekerakademi@gmail.com
LEAD_FROM_EMAIL=
NEXT_PUBLIC_GTM_ID=

# --- S3 ---
S3_REGION=eu-central-1
S3_BUCKET=sekeranaokulu-media
MEDIA_AWS_ACCESS_KEY_ID=
MEDIA_AWS_SECRET_ACCESS_KEY=
S3_BACKUP_BUCKET=sekeranaokulu-backup
BACKUP_AWS_ACCESS_KEY_ID=
BACKUP_AWS_SECRET_ACCESS_KEY=

# --- cron ---
SUPABASE_DB_URL=
HC_BACKUP_URL=
HC_CRON_DAILY_URL=
```

- [ ] **Step 2: `infra/docker-compose.yml`**

```yaml
name: seker

services:
  caddy:
    image: caddy:2.10-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    environment:
      SITE_HOST: ${SITE_HOST}
      PANEL_HOST: ${PANEL_HOST}
      ACME_EMAIL: ${ACME_EMAIL}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web
      - panel

  web:
    image: ghcr.io/${GHCR_OWNER}/seker-web:${IMAGE_TAG}
    restart: unless-stopped
    environment:
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      RESEND_API_KEY: ${RESEND_API_KEY}
      LEAD_NOTIFICATION_EMAIL: ${LEAD_NOTIFICATION_EMAIL}
      LEAD_FROM_EMAIL: ${LEAD_FROM_EMAIL}
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
      AUTH_COOKIE_DOMAIN: ${AUTH_COOKIE_DOMAIN}
      PANEL_URL: ${PANEL_URL}
    volumes:
      - web_cache:/app/apps/web/.next/cache
    mem_limit: 600m

  panel:
    image: ghcr.io/${GHCR_OWNER}/seker-panel:${IMAGE_TAG}
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
      SUPABASE_SECRET_KEY: ${SUPABASE_SECRET_KEY}
      AUTH_COOKIE_DOMAIN: ${AUTH_COOKIE_DOMAIN}
      SITE_URL: ${SITE_URL}
      CRON_SECRET: ${CRON_SECRET}
    mem_limit: 700m

  cron:
    build: ./cron
    restart: unless-stopped
    environment:
      TZ: Europe/Istanbul
      CRON_SECRET: ${CRON_SECRET}
      SUPABASE_DB_URL: ${SUPABASE_DB_URL}
      S3_BACKUP_BUCKET: ${S3_BACKUP_BUCKET}
      AWS_DEFAULT_REGION: ${S3_REGION}
      AWS_ACCESS_KEY_ID: ${BACKUP_AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${BACKUP_AWS_SECRET_ACCESS_KEY}
      HC_BACKUP_URL: ${HC_BACKUP_URL}
      HC_CRON_DAILY_URL: ${HC_CRON_DAILY_URL}
    depends_on:
      - panel
    mem_limit: 256m

volumes:
  caddy_data:
  caddy_config:
  web_cache:
```
Not: web servisi Faz 0'da `NEXT_PUBLIC_SUPABASE_*`/`AUTH_COOKIE_DOMAIN`/`PANEL_URL`'i kullanmaz; Faz 1–2 kullanacağı için şimdiden verilir. Web, `SUPABASE_SECRET_KEY`'i Faz 1'de alır.

- [ ] **Step 3: `infra/Caddyfile`**

```caddyfile
{
	email {$ACME_EMAIL}
}

{$SITE_HOST} {
	encode zstd gzip
	reverse_proxy web:3000
}

www.{$SITE_HOST} {
	redir https://{$SITE_HOST}{uri} permanent
}

{$PANEL_HOST} {
	encode zstd gzip
	header X-Robots-Tag "noindex, nofollow"
	reverse_proxy panel:3000
}
```

- [ ] **Step 4: Cron konteyneri**

`infra/cron/Dockerfile`:
```dockerfile
FROM alpine:3.22
# pg_dump 17, Supabase'in 15 ve 17 sunucularını yedekleyebilir (yeni istemci eski sunucuyu okur).
RUN apk add --no-cache curl postgresql17-client aws-cli tzdata
ENV TZ=Europe/Istanbul
COPY crontab /etc/crontabs/root
COPY entrypoint.sh backup.sh /app/
RUN chmod +x /app/entrypoint.sh /app/backup.sh
ENTRYPOINT ["/app/entrypoint.sh"]
```
`infra/cron/entrypoint.sh`:
```sh
#!/bin/sh
set -eu
# busybox crond işlere ortam değişkenlerini geçirmez; gerekenleri bir dosyaya yazıp her işte okutuyoruz.
: > /app/env.sh
for v in TZ CRON_SECRET SUPABASE_DB_URL S3_BACKUP_BUCKET AWS_DEFAULT_REGION AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY HC_BACKUP_URL HC_CRON_DAILY_URL; do
  eval "val=\${$v:-}"
  printf "export %s='%s'\n" "$v" "$val" >> /app/env.sh
done
chmod 600 /app/env.sh
exec crond -f -d 6
```
`infra/cron/crontab` (son satırdan sonra boş satır olmalı; busybox crond son satırı yoksayabilir):
```crontab
30 2 * * * . /app/env.sh; /app/backup.sh >> /proc/1/fd/1 2>&1
0 3 * * * . /app/env.sh; curl -fsS -m 300 -H "Authorization: Bearer $CRON_SECRET" http://panel:3000/api/cron/daily >> /proc/1/fd/1 2>&1 && if [ -n "$HC_CRON_DAILY_URL" ]; then curl -fsS -m 10 "$HC_CRON_DAILY_URL" > /dev/null; fi

```
`infra/cron/backup.sh`:
```sh
#!/bin/sh
set -eu
STAMP=$(date +%Y-%m-%dT%H%M)
FILE="/tmp/seker-$STAMP.dump"

# public = uygulama verisi, auth = kullanıcı hesapları (profiles bunlara bağlı).
# --format=custom zaten sıkıştırılmıştır ve seçerek geri yüklemeye izin verir.
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --file="$FILE"

SIZE=$(wc -c < "$FILE")
if [ "$SIZE" -lt 10000 ]; then
  echo "backup FAILED: dosya şüpheli derecede küçük ($SIZE bayt)" >&2
  rm -f "$FILE"
  exit 1
fi

aws s3 cp "$FILE" "s3://$S3_BACKUP_BUCKET/db/$STAMP.dump" --only-show-errors
rm -f "$FILE"

if [ -n "${HC_BACKUP_URL:-}" ]; then
  curl -fsS -m 10 "$HC_BACKUP_URL" > /dev/null
fi
echo "backup ok: db/$STAMP.dump ($SIZE bayt)"
```

- [ ] **Step 5: Yerel duman testi (compose + yedek, S3'süz)**

```bash
docker build -t seker-cron:local infra/cron
docker run --rm --entrypoint sh seker-cron:local -c 'pg_dump --version && aws --version && date'
docker run --rm --entrypoint sh seker-cron:local -c \
  'pg_dump "postgresql://postgres:postgres@host.docker.internal:54322/postgres" --format=custom --no-owner --no-privileges --schema=public --schema=auth --file=/tmp/x.dump && pg_restore --list /tmp/x.dump | grep -c "TABLE DATA public"'
```
Expected: `pg_dump (PostgreSQL) 17.x`, `aws-cli/2.x`, tarih `+03` saat diliminde; son komut ≥ 16 (panelin 16 tablosu).

Küçük-dosya korumasını dene:
```bash
docker run --rm -e SUPABASE_DB_URL="postgresql://postgres:postgres@host.docker.internal:54322/postgres" -e S3_BACKUP_BUCKET=x \
  --entrypoint sh seker-cron:local -c 'sed -i "s/--schema=public --schema=auth/--schema=storage_does_not_exist/" /app/backup.sh; /app/backup.sh; echo "exit=$?"'
```
Expected: `backup FAILED: dosya şüpheli derecede küçük` ve `exit=1`.

- [ ] **Step 6: `infra/restore.md` — geri yükleme prosedürü (Faz 0'da bir kez, sonra ayda bir)**

```markdown
# Veritabanı geri yükleme denemesi

Amaç: S3'teki gece yedeğinin gerçekten geri yüklenebildiğini kanıtlamak. Üretim veritabanına
**asla** geri yükleme yapılmaz; hedef her zaman yerel Supabase'tir.

1. Üretimdeki satır sayılarını not et (Supabase SQL Editor):
   `select (select count(*) from students) s, (select count(*) from leads) l, (select count(*) from installments) i, (select count(*) from auth.users) u;`
2. Son yedeği indir (yönetici AWS hesabıyla; yedek kullanıcısının okuma izni yoktur):
   `aws s3 ls s3://sekeranaokulu-backup/db/ | tail -3`
   `aws s3 cp s3://sekeranaokulu-backup/db/<en-son>.dump ./restore.dump`
3. Temiz yerel veritabanı: `cd packages/db && npx supabase db reset --no-seed`
4. Önce hesaplar, sonra uygulama verisi:
   `pg_restore --dbname=postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres --data-only --schema=auth --table=users --table=identities --disable-triggers ./restore.dump`
   `pg_restore --dbname=postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres --clean --if-exists --no-owner --schema=public ./restore.dump`
5. Aynı sayım sorgusunu yerelde çalıştır (`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`).
   Dört sayı 1. adımdakiyle aynı olmalı (yedek gece alındığı için gün içinde eklenenler kadar az olabilir).
6. Paneli yerel veritabanıyla aç (`pnpm --filter @seker/panel dev`) ve bir öğrencinin ödeme ızgarasını kontrol et.
7. Sonucu ve tarihi bu dosyanın sonundaki tabloya yaz. Yerel veriyi sil: `npx supabase db reset`.

| Tarih | Yedek dosyası | Sayılar eşleşti mi | Yapan |
|---|---|---|---|
```
(Not: 4. adımdaki `pg_restore` sürümü yedekteki pg_dump sürümünden düşük olamaz; yerelde 17 yoksa `docker run --rm -v "$PWD:/w" --network host seker-cron:local pg_restore …` ile konteynerden çalıştır.)

- [ ] **Step 7: Compose dosyasını doğrula**

```bash
cd infra && cp env.example .env && sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=local/' .env && docker compose config -q && echo valid; rm .env; cd ..
```
Expected: `valid`.

- [ ] **Step 8: Commit**

```bash
git add infra/docker-compose.yml infra/Caddyfile infra/env.example infra/cron infra/restore.md
git commit -m "feat(infra): docker compose, caddy, cron konteyneri ve gece yedeği"
```

---

### Task 9: GitHub deposu, CI ve otomatik dağıtım

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `infra/deploy.sh`, `infra/rollback.sh`

**Interfaces:**
- Consumes: Task 7 Dockerfile'ları, Task 8 compose dosyası
- Produces: `main`'e her push → CI (lint, typecheck, test, yerel Supabase'le RLS) → başarılıysa iki imaj `ghcr.io/meertseker/seker-{web,panel}:<sha>` → sunucuda `/opt/seker/deploy.sh <sha>`. Geri dönüş: `/opt/seker/rollback.sh`.

- [ ] **Step 1: GitHub deposu (sahip onayıyla)**

```bash
gh repo create meertseker/seker-platform --private --source . --remote origin
git push -u origin main
```
Expected: depo private olarak oluşur.

- [ ] **Step 2: `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Yerel Supabase (RLS testleri için)
        working-directory: packages/db
        run: pnpm exec supabase start
      - name: Test ortam değişkenleri
        working-directory: packages/db
        run: |
          pnpm exec supabase status -o json > /tmp/sb.json
          {
            echo "NEXT_PUBLIC_SUPABASE_URL=$(jq -r '.API_URL' /tmp/sb.json)"
            echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$(jq -r '.PUBLISHABLE_KEY // .ANON_KEY' /tmp/sb.json)"
            echo "SUPABASE_SECRET_KEY=$(jq -r '.SECRET_KEY // .SERVICE_ROLE_KEY' /tmp/sb.json)"
          } >> "$GITHUB_ENV"
      - run: pnpm turbo run lint typecheck test
```

- [ ] **Step 3: `.github/workflows/deploy.yml`**

```yaml
name: deploy

on:
  workflow_run:
    workflows: [ci]
    types: [completed]
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-production
  cancel-in-progress: false

env:
  SHA: ${{ github.event.workflow_run.head_sha || github.sha }}

jobs:
  build:
    if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        app: [web, panel]
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ env.SHA }}
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: infra/Dockerfile.${{ matrix.app }}
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/seker-${{ matrix.app }}:${{ env.SHA }}
          build-args: |
            NEXT_PUBLIC_SUPABASE_URL=${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${{ vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
            NEXT_PUBLIC_GTM_ID=${{ vars.NEXT_PUBLIC_GTM_ID }}
          cache-from: type=gha,scope=${{ matrix.app }}
          cache-to: type=gha,mode=max,scope=${{ matrix.app }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ env.SHA }}
      - name: SSH ayarı
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          echo "${{ secrets.DEPLOY_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
      - name: Altyapı dosyalarını gönder
        run: scp -r infra/docker-compose.yml infra/Caddyfile infra/cron infra/deploy.sh infra/rollback.sh deploy@${{ secrets.DEPLOY_HOST }}:/opt/seker/
      - name: Yayına al
        run: ssh deploy@${{ secrets.DEPLOY_HOST }} "chmod +x /opt/seker/deploy.sh /opt/seker/rollback.sh && /opt/seker/deploy.sh ${{ env.SHA }}"
```
Not: Her dağıtımda iki imaj da derlenir (tek `IMAGE_TAG`, sözleşmeyle uyumlu). Docker katman önbelleği değişmeyen uygulamanın derlemesini kısaltır.

- [ ] **Step 4: `infra/deploy.sh` ve `infra/rollback.sh`**

`infra/deploy.sh`:
```sh
#!/bin/sh
# Kullanım: deploy.sh <git-sha>. Sağlık kontrolü geçmezse bir önceki etikete döner.
set -eu
cd /opt/seker
NEW_TAG="$1"
PREV_TAG=$(grep '^IMAGE_TAG=' .env | cut -d= -f2)

set_tag() { sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" .env; }
healthy() {
  docker compose exec -T web wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 &&
  docker compose exec -T panel wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1
}

set_tag "$NEW_TAG"
if ! docker compose pull web panel; then
  set_tag "$PREV_TAG"
  echo "imaj çekilemedi: $NEW_TAG; $PREV_TAG etiketinde kalındı" >&2
  exit 1
fi
docker compose up -d --build --remove-orphans

i=0
until healthy; do
  i=$((i + 1))
  if [ "$i" -ge 12 ]; then
    echo "sağlık kontrolü 60 sn içinde geçmedi; $PREV_TAG etiketine dönülüyor" >&2
    set_tag "$PREV_TAG"
    docker compose up -d --remove-orphans
    exit 1
  fi
  sleep 5
done

[ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$NEW_TAG" ] && echo "$PREV_TAG" > .previous_tag
docker image prune -af --filter "until=168h" >/dev/null
echo "yayında: $NEW_TAG"
```
`infra/rollback.sh`:
```sh
#!/bin/sh
# Elle geri dönüş: bir önceki başarılı etikete geçer.
set -eu
cd /opt/seker
PREV_TAG=$(cat .previous_tag)
exec /opt/seker/deploy.sh "$PREV_TAG"
```

- [ ] **Step 5: GitHub ayarları (sahip yapar, Task 10'daki sunucu hazır olunca)**

`gh` ile:
```bash
gh variable set NEXT_PUBLIC_SUPABASE_URL --body "https://<proje-ref>.supabase.co"
gh variable set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY --body "sb_publishable_..."
gh variable set NEXT_PUBLIC_GTM_ID --body "GTM-..."
gh api -X PUT repos/meertseker/seker-platform/environments/production >/dev/null
gh secret set DEPLOY_HOST --env production --body "<lightsail-sabit-ip>"
gh secret set DEPLOY_SSH_KEY --env production < ~/.ssh/seker_deploy
ssh-keyscan -t ed25519 <lightsail-sabit-ip> | gh secret set DEPLOY_KNOWN_HOSTS --env production
```
(Publishable anahtar ve GTM kimliği gizli değildir, tarayıcıya zaten gider; bu yüzden `vars`.)

- [ ] **Step 6: CI'ı doğrula**

```bash
git add .github infra/deploy.sh infra/rollback.sh
git commit -m "ci: lint/typecheck/test iş akışı ve GHCR + SSH dağıtımı"
git push
gh run watch --exit-status $(gh run list --workflow ci --limit 1 --json databaseId -q '.[0].databaseId')
```
Expected: `ci` yeşil. `deploy` iş akışı sunucu ve sırlar hazır olmadan başarısız olur; bu beklenen durumdur (Task 10 Step 6'da tekrar tetiklenir).

---

### Task 10: AWS (S3, IAM, Lightsail), sunucu kurulumu, staging yayını ve izleme

**Files:**
- Create: `infra/server-setup.md`, `infra/aws/media-bucket-policy.json`, `infra/aws/backup-lifecycle.json`, `infra/aws/iam-web-media.json`, `infra/aws/iam-backup.json`

**Interfaces:**
- Consumes: Task 8–9 çıktıları
- Produces: `https://yeni.sekeranaokulu.com` ve `https://panel-yeni.sekeranaokulu.com` üretim veritabanıyla çalışır; S3 kovaları `sekeranaokulu-media` (Faz 2 kullanır) ve `sekeranaokulu-backup`; izleme kuralları.

- [ ] **Step 1: AWS politika dosyaları**

`infra/aws/media-bucket-policy.json` (yalnızca `site-images/` herkese okunur):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadSiteImages",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::sekeranaokulu-media/site-images/*"
    }
  ]
}
```
`infra/aws/backup-lifecycle.json`:
```json
{
  "Rules": [
    {
      "ID": "expire-db-dumps-30d",
      "Status": "Enabled",
      "Filter": { "Prefix": "db/" },
      "Expiration": { "Days": 30 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 30 }
    }
  ]
}
```
`infra/aws/iam-web-media.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::sekeranaokulu-media/site-images/*"
    }
  ]
}
```
`infra/aws/iam-backup.json` (yalnızca yazma; sızsa bile yedekler okunamaz/silinemez, sürümleme üzerine yazmayı korur):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::sekeranaokulu-backup/db/*"
    }
  ]
}
```

- [ ] **Step 2: S3 ve IAM (sahip, yönetici AWS hesabıyla, yerel AWS CLI)**

```bash
aws s3api create-bucket --bucket sekeranaokulu-media --region eu-central-1 --create-bucket-configuration LocationConstraint=eu-central-1
aws s3api put-public-access-block --bucket sekeranaokulu-media --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket sekeranaokulu-media --policy file://infra/aws/media-bucket-policy.json

aws s3api create-bucket --bucket sekeranaokulu-backup --region eu-central-1 --create-bucket-configuration LocationConstraint=eu-central-1
aws s3api put-public-access-block --bucket sekeranaokulu-backup --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket sekeranaokulu-backup --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket sekeranaokulu-backup --lifecycle-configuration file://infra/aws/backup-lifecycle.json

for u in seker-web-media seker-backup; do aws iam create-user --user-name $u; done
aws iam put-user-policy --user-name seker-web-media --policy-name media --policy-document file://infra/aws/iam-web-media.json
aws iam put-user-policy --user-name seker-backup --policy-name backup --policy-document file://infra/aws/iam-backup.json
aws iam create-access-key --user-name seker-web-media
aws iam create-access-key --user-name seker-backup
```
Expected: son iki komut `AccessKeyId`/`SecretAccessKey` verir; bunları yalnızca sunucudaki `.env`'e yaz (Step 5). Kova adı alınmışsa `-1` ekle ve `.env` + politika dosyalarını buna göre güncelle.

- [ ] **Step 3: `infra/server-setup.md` — Lightsail sunucusu**

```markdown
# Lightsail sunucu kurulumu (bir kez)

## 1. Sunucu (konsol: lightsail.aws.amazon.com)
- Create instance → Region **Frankfurt (eu-central-1)**, zone `eu-central-1a`
- Platform Linux/Unix → OS Only → **Ubuntu 24.04 LTS**
- Plan: **12 USD/ay** (2 GB RAM, 2 vCPU, 60 GB SSD, 3 TB transfer, IPv4'lü)
- SSH anahtar çifti: kendi `~/.ssh/id_ed25519.pub`'ını yükle
- Ad: `seker-1`
- Oluşunca: Networking → **Create static IP** → `seker-1`'e bağla (bağlıyken ücretsiz)
- Networking → IPv4 Firewall: yalnızca SSH 22, HTTP 80, HTTPS 443 (TCP) ve 443 (UDP, HTTP/3). IPv6 Firewall: aynı.
- Snapshots → **Enable automatic snapshots** (günlük, son 7'si tutulur; depolama ücreti GB başına ayrıca).

Supabase projesinin bölgesini kontrol et (Supabase → Project Settings → General → Region).
`eu-central-1` değilse sunucuyu o bölgeye en yakın Lightsail bölgesinde aç.

## 2. İlk bağlantı ve sertleştirme
    ssh ubuntu@<static-ip>
    sudo apt update && sudo apt -y full-upgrade
    sudo apt -y install unattended-upgrades fail2ban
    sudo dpkg-reconfigure -f noninteractive unattended-upgrades
    sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
    sudo systemctl restart ssh
    sudo timedatectl set-timezone Europe/Istanbul

## 3. Swap (2 GB)
    sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
    sudo mkswap /swapfile && sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    free -h

## 4. Docker ve deploy kullanıcısı
    curl -fsSL https://get.docker.com | sudo sh
    sudo useradd -m -s /bin/bash -G docker deploy
    sudo mkdir -p /home/deploy/.ssh /opt/seker
    # Yerelde: ssh-keygen -t ed25519 -f ~/.ssh/seker_deploy -N "" ; açık anahtarı aşağıya yapıştır
    echo "<~/.ssh/seker_deploy.pub içeriği>" | sudo tee /home/deploy/.ssh/authorized_keys
    sudo chown -R deploy:deploy /home/deploy/.ssh /opt/seker
    sudo chmod 700 /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys

Not: Lightsail güvenlik duvarı yeterli; ufw kullanılmıyor çünkü Docker yayınladığı portlarda ufw kurallarını zaten atlar.

## 5. GHCR erişimi (private imajlar)
GitHub → Settings → Developer settings → Personal access tokens (classic) → yalnızca `read:packages`.
    sudo -iu deploy
    echo "<token>" | docker login ghcr.io -u meertseker --password-stdin

## 6. Ortam dosyası
    cd /opt/seker
    nano .env      # infra/env.example'daki tüm anahtarlar, gerçek değerlerle
    chmod 600 .env
`SUPABASE_DB_URL`: Supabase → Connect → **Session pooler** bağlantı dizesi (IPv4; doğrudan bağlantı yalnızca IPv6'dır).
`CRON_SECRET`: `openssl rand -hex 32`.
`IMAGE_TAG`: ilk dağıtımda boş bırak; deploy.sh doldurur.
```

- [ ] **Step 4: Supabase yeni anahtarları (sahip)**

Supabase Dashboard → Settings → **API Keys** → "Create new API keys": bir publishable ve bir secret anahtar oluştur. Eski `anon`/`service_role` anahtarları **bu fazda devre dışı bırakılmaz** (Vercel'deki eski panel geri dönüş haftasında onlarla çalışır; Task 11 Step 7'de kapatılır).

- [ ] **Step 5: Sunucu `.env`'ini staging için doldur**

`/opt/seker/.env` içinde `SITE_HOST=yeni.sekeranaokulu.com`, `PANEL_HOST=panel-yeni.sekeranaokulu.com`; diğer değerler gerçek. Web'in Faz 0 değişkenleri (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_PASSWORD`, `RESEND_API_KEY`) bugün Amplify konsolundaki ortam değişkenlerinden kopyalanır (Amplify → App settings → Environment variables).

DNS panelinde (sahip): `yeni`, `www.yeni`, `panel-yeni` için A kaydı → Lightsail sabit IP (TTL 300).

- [ ] **Step 6: İlk dağıtım**

```bash
gh workflow run deploy --ref main
gh run watch --exit-status $(gh run list --workflow deploy --limit 1 --json databaseId -q '.[0].databaseId')
curl -s https://yeni.sekeranaokulu.com/api/health
curl -s https://panel-yeni.sekeranaokulu.com/api/health
curl -sI https://www.yeni.sekeranaokulu.com | grep -i location
```
Expected: iş akışı yeşil; `{"ok":true}` iki kez; `location: https://yeni.sekeranaokulu.com/`.

- [ ] **Step 7: Staging kabul kontrolü (elle)**

1. https://yeni.sekeranaokulu.com — ana sayfa, `/kayit`, beş `/lp/*` sayfası açılıyor, görseller yükleniyor.
2. `/kayit`'ten "TEST Faz0 staging" / `05000000000` başvurusu gönder → e-posta geliyor, eski `/admin`'de görünüyor. Sonra o kaydı eski başvuru veritabanından sil.
3. https://panel-yeni.sekeranaokulu.com — gerçek yönetici hesabıyla giriş → pipeline, öğrenciler, ödeme ızgarası açılıyor. Çıkış → tekrar giriş çalışıyor. Tarayıcıda `sb-…-auth-token` çerezinin Domain'i `.sekeranaokulu.com`.
4. **Uyarı:** staging paneli üretim veritabanına bağlıdır; test verisi girme.

- [ ] **Step 8: Geri dönüşü dene**

```bash
ssh deploy@<ip> 'cd /opt/seker && T=$(grep ^IMAGE_TAG= .env); /opt/seker/deploy.sh does-not-exist; echo "exit=$?"; [ "$(grep ^IMAGE_TAG= .env)" = "$T" ] && echo "etiket korundu"'
ssh deploy@<ip> 'cd /opt/seker && docker compose ps --format "{{.Service}} {{.Status}}"'
```
Expected: `imaj çekilemedi: does-not-exist`, `exit=1`, `etiket korundu`; ikinci komutta `web` ve `panel` `Up … (healthy)`.

Sağlık kontrolüyle dönüşü de dene: GitHub'da `apps/web/app/api/health/route.ts`'i geçici olarak 500 döndüren bir dalda derleyip `gh workflow run deploy --ref <dal>` ile gönder → `deploy.sh` "sağlık kontrolü 60 sn içinde geçmedi" yazıp önceki etikete döner, site açık kalır. Dalı sil.

- [ ] **Step 9: İzleme**

- **UptimeRobot** (ücretsiz, 5 dk aralık): `https://yeni.sekeranaokulu.com/api/health` ve `https://panel-yeni.sekeranaokulu.com/api/health`, keyword `"ok":true`, uyarı e-postası: `meertseker@gmail.com`. (Geçişte adresler canlıya çevrilir.)
- **Healthchecks.io** (ücretsiz): iki check — `seker-backup` (period 1 gün, grace 2 saat) ve `seker-cron-daily` (period 1 gün, grace 2 saat). Ping URL'lerini `.env`'de `HC_BACKUP_URL` ve `HC_CRON_DAILY_URL`'e yaz, `docker compose up -d cron`.
- Yedeği hemen dene: `ssh deploy@<ip> 'cd /opt/seker && docker compose exec -T cron sh -c ". /app/env.sh; /app/backup.sh"'`
  Expected: `backup ok: db/<tarih>.dump (… bayt)`; Healthchecks'te `seker-backup` yeşil; `aws s3 ls s3://sekeranaokulu-backup/db/` dosyayı listeler.
- `infra/restore.md` prosedürünü bu dosyayla bir kez uygula ve tabloya ilk satırı yaz.

- [ ] **Step 10: Commit**

```bash
git add infra/server-setup.md infra/aws infra/restore.md infra/deploy.sh
git commit -m "docs(infra): lightsail kurulumu, s3/iam politikaları, ilk geri yükleme kaydı"
git push
```

---

### Task 11: Canlıya geçiş, eski platformların kapatılması ve Google Ads başvurusu

**Files:**
- Create: `infra/cutover.md`

**Interfaces:**
- Consumes: Task 10'da doğrulanmış staging
- Produces: `sekeranaokulu.com` ve `panel.sekeranaokulu.com` Lightsail'de; Amplify ve Vercel trafiği almıyor. Faz 1+ bu adreslere göre çalışır.

- [ ] **Step 1: `infra/cutover.md` — geçiş kontrol listesi (bu dosya adımların kaydıdır)**

```markdown
# Canlıya geçiş

| Adım | Ne zaman | Yapan | Tamam |
|---|---|---|---|
| DNS TTL'lerini 300 sn'ye düşür (@, www, panel) | Geçişten ≥ 24 saat önce | Sahip | |
| Personeli bilgilendir: panel adresi panel.sekeranaokulu.com olacak, bir kez yeniden giriş gerekecek | Geçişten 1 gün önce | Sahip | |
| `.env`'de SITE_HOST/PANEL_HOST canlı adlara | Geçiş anı | Geliştirici | |
| A kayıtları → Lightsail sabit IP | Geçiş anı | Sahip | |
| Canlı kontroller (aşağıda) | Geçişten hemen sonra | Geliştirici | |
| Vercel'de CRON_SECRET'ı sil (eski günlük işi etkisizleştirir) | Geçişten hemen sonra | Geliştirici | |
| Amplify ve Vercel'e dokunma (geri dönüş için) | 7 gün | — | |
| Amplify uygulamasını ve Vercel projelerini sil, eski anahtarları kapat | Geçiş + 7 gün | Sahip | |

Geri dönüş (7 gün içinde): A kayıtlarını eski değerlere al (aşağıya not edildi), Vercel'de CRON_SECRET'ı geri ekle.
Eski DNS değerleri: @ → ……  www → ……  panel → …… (geçişten önce DNS panelinden kopyala)
```

- [ ] **Step 2: TTL düşür ve eski değerleri kaydet (geçişten ≥ 24 saat önce, sahip)**

DNS panelinde `@`, `www` ve (varsa) `panel` kayıtlarının mevcut değerlerini `infra/cutover.md`'deki "Eski DNS değerleri" satırına yaz, TTL'lerini 300 yap.
Amplify alan adını kendisi yönetiyorsa (Route 53 + Amplify custom domain), Amplify → Domain management'tan alan adı bağlantısını **geçiş anında** kaldırmak gerekir; aksi halde Amplify kayıtları geri yazabilir.

- [ ] **Step 3: Geçiş**

```bash
ssh deploy@<ip> "cd /opt/seker && sed -i 's/^SITE_HOST=.*/SITE_HOST=sekeranaokulu.com/; s/^PANEL_HOST=.*/PANEL_HOST=panel.sekeranaokulu.com/' .env && docker compose up -d"
```
Sahip DNS'te: `@` A → sabit IP, `www` A (veya CNAME `sekeranaokulu.com`) → sabit IP, `panel` A → sabit IP.

- [ ] **Step 4: Canlı kontroller**

```bash
dig +short sekeranaokulu.com panel.sekeranaokulu.com
curl -s https://sekeranaokulu.com/api/health
curl -s https://panel.sekeranaokulu.com/api/health
curl -sI https://www.sekeranaokulu.com | grep -i location
curl -sI https://panel.sekeranaokulu.com | grep -i x-robots-tag
```
Expected: iki IP de Lightsail sabit IP'si; `{"ok":true}` iki kez; `location: https://sekeranaokulu.com/`; `x-robots-tag: noindex, nofollow`.

Elle: `https://sekeranaokulu.com/lp/beylikduzu-anaokulu?gclid=TESTCUTOVER` → formu "TEST geçiş" / `05000000000` ile gönder → e-posta gelir ve eski `/admin`'de `gclid=TESTCUTOVER` ile görünür (reklam atfının bozulmadığını gösterir). Sonra kaydı sil. Google Tag Assistant ile GTM'in yüklendiğini kontrol et.
UptimeRobot monitörlerini canlı adreslere çevir.

- [ ] **Step 5: Eski günlük işi etkisizleştir**

Vercel → `anaokulcrm` projesi → Settings → Environment Variables → `CRON_SECRET`'ı sil → Redeploy. Ertesi sabah 03:00'ten sonra: Healthchecks'te `seker-cron-daily` yeşil, panelde görev/bildirim **tekrar** üretilmemiş (cron kuralları zaten tekilleştiriyor, yine de bak).

- [ ] **Step 6: Google Ads API developer token başvurusu (sahip, paralel bekler)**

Faz 3 için şimdiden: Google Ads yönetici hesabı (MCC) yoksa oluştur ve okulun reklam hesabını bağla → MCC'de Tools → **API Center** → developer token al → **Basic access** başvurusu yap (kullanım: "kendi okulumuzun kampanya harcamasını okumak ve offline dönüşüm yüklemek"). Onay günler–haftalar sürebilir; başvuru tarihini `infra/cutover.md`'nin altına not et.

- [ ] **Step 7: 7 gün sonra eski platformları kapat (sahip + geliştirici)**

Önce son kontrol: 7 gün boyunca UptimeRobot kesintisiz, her gece Healthchecks `seker-backup` yeşil.
- AWS Amplify → uygulamayı sil.
- Vercel → `anaokulcrm`, `annem`, `seker-anaokulu-onizleme` projelerini sil.
- Supabase → Settings → API Keys → eski **anon** ve **service_role** anahtarlarını devre dışı bırak (geri alınabilir). Ardından panel ve siteye bir kez giriş/form kontrolü yap. (Sitenin eski başvuru veritabanı ayrı bir proje olduğu için o, Faz 1'de kapanır.)
- `meertseker/react-kindergarten-site` deposunu arşivle; herkese açıksa önce private yap (Task 1 Step 4 notu).
- annem deposundaki `panel-export` dalını sil: `git -C /c/Users/meert/Desktop/annem branch -D panel-export`.

- [ ] **Step 8: Commit**

```bash
git add infra/cutover.md
git commit -m "docs(infra): canlıya geçiş kaydı"
git push
```

**Faz 0 bitti sayılır (spec):** iki uygulama yeni sunucuda yayında, Amplify ve Vercel trafiği almıyor, gece yedeği S3'te görünüyor ve bir kez geri yüklenmiş.

---

## Self-Review notları

- **Spec kapsamı:** monorepo + geçmiş (T2), Next 16 (T6), yeni anahtarlar (T5), Lightsail/Docker/Caddy (T7–T8, T10), GitHub Actions (T9), gece yedeği + geri yükleme denemesi (T8, T10), uptime (T10), alan adı taşıması + 1 hafta geri dönüş (T11), developer token başvurusu (T11), commit edilmemiş değişiklikler (T1). Spec'teki "Pazar 04:00 snapshot, son 2" yerine Lightsail'in yerleşik günlük otomatik snapshot'ı (son 7) kullanıldı: kurulum yok, maliyet farkı küçük.
- **Sözleşmeden sapmalar / eklemeler (indekse işlenmeli):** `S3_BACKUP_BUCKET`, `HC_BACKUP_URL`, `HC_CRON_DAILY_URL`, `GHCR_OWNER`, `ACME_EMAIL`, `MEDIA_AWS_*` / `BACKUP_AWS_*` (konteynerde `AWS_ACCESS_KEY_ID`'ye eşlenir) yeni env adları; `getEditor()` Faz 2'ye kaldı; Faz 0'da web hâlâ eski `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`ADMIN_PASSWORD` kullanır; `requireEnv` zod'suz basit fonksiyon.
- **Doğrulanamayanlar (uygulamada dikkat):** `@supabase/ssr` 0.12.7'nin `CookieOptionsWithName` tipinde `domain`'i kabul ettiği (kaynakta var, burada çalıştırılmadı); Next 16 codemod'unun `unstable_ViewTransition`'a dokunup dokunmadığı (T6 Step 5 koşullu düzeltme içeriyor); `supabase status -o json` çıktısındaki `PUBLISHABLE_KEY`/`SECRET_KEY` alan adları (CI `//` ile eski adlara düşer); `supabase_admin:postgres` yerel süper kullanıcı parolası (restore.md 4. adım).
