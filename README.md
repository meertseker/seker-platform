# Şeker Okul Platformu

- `apps/web` — sekeranaokulu.com (Next.js 16)
- `apps/panel` — panel.sekeranaokulu.com (Next.js 16, eski anaokulcrm)
- `packages/*` — ortak kod (`@seker/shared`, `@seker/auth`, `@seker/db`)
- `infra/` — Docker Compose, Caddy, cron, sunucu kurulumu

Yerel çalıştırma: `pnpm install`, `pnpm db:start`, `pnpm dev`.
Plan ve spec: `docs/superpowers/`.

## Başvuru akışı

- Veli formu → `create_web_lead` (RPC) → panel: lead oluşturulur, bildirim ve e-posta gönderilir.
- Tekrar başvuru kuralı: aynı telefon için açık lead varsa yeni kart açılmaz, mevcut lead aktivitesine "tekrar başvurdu" olayı yazılır; bildirim 10 dk susturulur.
- Varsayılan danışman: `app_settings.web_lead_assignee` (atanmamışsa yalnız yöneticiler bildirim alır).
