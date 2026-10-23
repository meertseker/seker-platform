# Reklam Konsolu — Paket Dizini

**Spec:** `docs/superpowers/specs/2026-10-23-reklam-konsolu-design.md` (bağlayıcı). Ekran tasarımları: https://claude.ai/artifact/G37pQjW7qanRXmTMxxe3FR · Okul sunumu: https://claude.ai/artifact/PnraphFfFKka7B8pkNsJhH

Üç paket aynı gece, üç ayrı dal ve worktree'de, birbirinden bağımsız geliştirilir. Birleştirme sırası **A → B → C**; B ve C birleştirmeden önce main'e rebase eder. Paket D spec K26 ile A ve C'ye dağıtıldı.

| Paket | Plan | Dal · worktree | Migration | Ne çıkar | Dış şart |
|---|---|---|---|---|---|
| A · Sayfa yayını + İçeriğim | `2026-10-23-01-reklam-konsolu-a-sayfa.md` | `feat/reklam-konsolu-a` · `../seker-platform-rk-a` | 0024 `landing_pages` | DB'den okunan `/lp/<slug>`, gizli önizleme, panelde Z3 (önizle + yayınla), öğretmen O2 alanları (reklam cümlesi/başlığı, görsel seçimi), O3 İçeriğim, `content_owner_summary()` | yok |
| B · Instagram'a yayın | `2026-10-23-02-reklam-konsolu-b-instagram.md` | `feat/reklam-konsolu-b` · `../seker-platform-rk-b` | 0025 `ig_yayin` | Z1 oynatıcı + Instagram önizleme + MEB kapısı, Z2 yayınla (şimdi/saat), `/api/cron/content`, O1 biçim kontrolü + kapak karesi, Z6 bağlantı kartları, `IG_PUBLISH_ENABLED` | Instagram işletme hesabı + Facebook sayfası + `instagram_content_publish` izni (Mert) |
| C · Panelden reklam + takip | `2026-10-23-03-reklam-konsolu-c-reklam.md` | `feat/reklam-konsolu-c` · `../seker-platform-rk-c` | 0026 `reklam_kurulum` | Z6 reklam şablonu + "Kampanyaları kur", Z4 Reklam testine al (9 kontrol), Z5 Instagram satırları + Büyütmeye taşı + uygulandı satırı, M1 öneri → gerçek uygulama, M2 Reklam kayıt defteri, dışlama kitlesi | `META_*` env (Mert); `ADS_WRITE_ENABLED` ilk hafta kapalı ("sadece göster") |

## Ortak kurallar

- İşçi oturum kuralları CLAUDE.md'de: main'e push, prod migration, deploy, prod'a yazan SQL **yok**. Migration SQL'ini prod'a koordinatör uygular.
- Numaralar koordinatör tarafından ayrıldı (23.10): 0024 A, 0025 B, 0026 C. Başka numara gerekirse koordinatöre SendMessage.
- Paylaşılan dosya kuralı (spec §11): `actions/content.ts`'e dokunulmaz; yeni eylemler `actions/pages.ts` (A), `actions/instagram.ts` (B), `actions/ad-setup.ts` (C). İçerik kartı ve Ayarlar sayfasına yalnız kendi bileşenini ekleyen tek satır. `infra/docker-compose.yml` ve `infra/cron/crontab` yalnız ekleme.
- Cross-paket sözleşmeler (adlar spec'te sabit): A → `apps/panel/lib/pages/store.ts` `getLandingPageByContent(contentId)`; B → `content_items.ig_publish_status`, `ig_published_at`, `media_meta.{vertical,durationS,subtitled}`; C bunları `lib/ads/preflight-sources.ts` adaptöründen okur, A/B birleşene kadar stub.
- `ad_change_log.action` check kısıtı: B `ig_yayin` ekler, C B'nin değerini de içererek yeniden kurar (drop + create).
- Her paket bitince: `pnpm turbo run lint typecheck test` yeşil, iki `next build` yeşil, `superpowers:requesting-code-review`, teslim şablonu `../seker-platform-ledgers/teslim/<dal>.md` + koordinatöre SendMessage, Mert'e Türkçe kısa özet.
- Gece oturumu prompt'u: `C:\Users\meert\Desktop\seker-reklam-konsolu-gece-prompt.md`.
