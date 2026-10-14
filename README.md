# Şeker Okul Platformu

- `apps/web` — sekeranaokulu.com (Next.js 16)
- `apps/panel` — panel.sekeranaokulu.com (Next.js 16, eski anaokulcrm)
- `packages/*` — ortak kod (`@seker/shared`, `@seker/auth`, `@seker/db`)
- `infra/` — Docker Compose, Caddy, cron, sunucu kurulumu

Yerel çalıştırma: `pnpm install`, `pnpm db:start`, `pnpm dev`.
Plan ve spec: `docs/superpowers/`.
