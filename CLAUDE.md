# seker-platform — ajan kuralları

Bu repoda aynı anda birden çok Claude oturumu çalışır. Bir oturum **koordinatör**, diğerleri **işçi**. Oturum açılınca `SessionStart` hook'u rolünü, dalını ve defter durumunu yazar.

## Roller

**Koordinatör** (tek oturum; kim olduğu `../seker-platform-ledgers/koordinator` dosyasında oturum kimliğiyle yazılı):
- main'e birleştirir ve push eder, deploy'u izler (`gh run watch`, `/api/health`).
- Prod migration'ı uygular, migration numarası verir, defterin tek yazarıdır.
- Yeni bir plan yazılmadan önce defterdeki aktif işlerle çakışmasına bakar.
- Birleştirdiği dalın worktree'sini ve yerel dalını aynı gün kaldırır.

**İşçi** (diğer tüm oturumlar):
- main üzerinde çalışmaz. İşe `origin/main`'den yeni dal ve ayrı worktree ile başlar (`../seker-platform-<iş>`), dalın upstream'ini main yapmaz.
- main'e push etmez, `supabase db push` yapmaz, deploy etmez, prod'a yazan SQL çalıştırmaz. `.claude/hooks/ajan-kapisi.mjs` bunları engeller; engel çıkarsa aşmaya çalışma, koordinatöre yaz.
- Yeni migration gerekiyorsa numarayı koordinatörden SendMessage ile alır.
- Bitince aşağıdaki şablonla teslim eder.

## Teslimden önce

```bash
pnpm turbo run lint typecheck test
pnpm --filter @seker/web build
pnpm --filter @seker/panel build   # NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY sahte değer yeterli
```

CI artık iki build'i de çalıştırıyor, ama teslimden önce yerelde de çalıştır.

## Teslim şablonu

Mesajı koordinatöre SendMessage ile gönder, aynısını `../seker-platform-ledgers/teslim/<dal-adı>.md` dosyasına yaz (mesaj kaybolursa dosya kalır).

```
dal: feat/…            sha: …
worktree: ../seker-platform-…
dokunulan: (klasör/dosya listesi)
migration: yok | NNNN (dosya: packages/db/supabase/migrations/…)
kontroller: lint ✓ typecheck ✓ test ✓ web build ✓ panel build ✓
env / crontab değişikliği: yok | …
riskler: …
Mert'ten beklenen karar: yok | …
```

## Kod kuralları

- Sunucu bileşeninde `new Date()` / `Date.now()` kullanma; `lib/time` yardımcılarını kullan (Next 16 cache-components prerender hatası).
- Deploy migration çalıştırmaz. Kod yeni kolona dayanıyorsa migration main push'tan önce prod'a uygulanmalı.
- Prod migration Supabase MCP `execute_sql` ile uygulanır ve `supabase_migrations.schema_migrations` tablosuna `NNNN` sürümüyle satır eklenir; `apply_migration` kullanılmaz.
- Okul kullanıcılarının (mehtap@, zehra@) hesabıyla prod'a giriş yapma; tek oturum kontrolü onları düşürür. Doğrulamayı SQL ile yap.
- `events` / `lead_notes` tablolarına toplu insert WhatsApp grubuna mesaj olarak düşer (0013 trigger'ları). Toplu veri öncesi `wa_enabled=false` ya da `event_type='seed_import'`.

## Durum nerede

- Migration numaraları, aktif işler, bekleyen kararlar: `../seker-platform-ledgers/migrations.md`
- Kalıcı kurallar: bu dosya. Değişen durum bu dosyaya yazılmaz.
