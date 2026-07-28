# 2026-2027 Aidat Roster Importer — Design

**Date:** 2026-07-28
**Status:** Approved (design), pending implementation plan
**Author:** product owner + Claude

## 1. Purpose

Import the upcoming **2026-2027** student roster and their fee structure from the
school's dues workbook (`2025 - 2026 DÖNEMİ AİDAT LİSTESİ.xlsx`, sheet
`2026 - 2027`) into the AnaOkulCRM database, as part of the pre-handoff data setup.

The workbook is a human-maintained fee ledger, **not** a clean roster. The
`2026 - 2027` sheet is an early, in-progress list: 16 named students, of which
only ~9 have any fee amount and only ~6 have a phone recoverable from historical
data. This importer follows the repo's established **parse → human review →
upload** seed pattern so the incomplete data is reviewed and completed by a human
before anything is written to the database.

## 2. Scope

**In scope**
- New parser `scripts/seed/parse-aidat.ts` → reviewable `out/students-2026-2027.csv`.
- New uploader `scripts/seed/upload-aidat.ts` (dry-run by default) → `students`,
  `payment_plans`, `installments`.
- Phone recovery from existing seed/CSV/WhatsApp/vCard/DATA-KAYIT sources, with a
  confidence tag per match (human verifies before upload).
- Program inference from the aidat amount, flagged as a guess.
- Unit tests (vitest, no live DB) for the parser and the insert-builder.

**Out of scope** (documented as manual follow-ups)
- `price_lists` / `price_list_items`: aidat is individually negotiated per family,
  so there is no clean per-program list price in the data. The yönetici sets
  standard prices in-app after handoff.
- Reconstructing paid/unpaid **payment history**: the monthly ledger cells are
  inconsistent (mix aidat/servis, ramp mid-year). We create a **forward schedule
  of all-`bekliyor` installments** instead.
- **Production** database. This runs against **local Supabase** (`.env.local`,
  `127.0.0.1:54321`). Prod is an env-var swap at handoff time, done deliberately.
- Leads, appointments, and the 2025-2026 (finished) roster.

## 3. Source data reality (sheet `2026 - 2027`)

16 rows with a student name. Header row 0; data from row 1. Relevant columns:

| Col | Header | Notes |
|----:|--------|-------|
| A (0) | ÖĞRENCİ ADI VE SOYADI | student full name — all 16 present |
| B (1) | ANNE & BABA ADI | parent first names, e.g. `GÖKÇEN & HAKAN` — 14/16 present |
| C (2) | KİTAP - KIRTASİYE | book/stationery amount (TL) — ~9 present |
| D (3) | AİDAT TUTARI | **inconsistent**: annual lump (`250000`), monthly (`23000`), or text (`23.000 Y - 28.000 TAM`) — ~9 present |
| F (5) | SERVİS TUTARI | transport (TL) — 0 present on this sheet |
| G–R (6–17) | TEMMUZ…HAZİRAN | per-month ledger cells — ignored for import (history is out of scope) |

Field availability: name 16/16, parent 14/16, phone 6/16 (recovered; see §5),
aidat 9/16, kitap 9/16, servis 0/16.

## 4. Component ① — `scripts/seed/parse-aidat.ts`

Reads the workbook, iterates named rows on `2026 - 2027`, writes
`scripts/seed/out/students-2026-2027.csv` (gitignored — contains real names). No
DB access. Mirrors the style, CLI shape, and Turkish comments of the existing
`parse-excel.ts`.

**CLI:** `npx tsx scripts/seed/parse-aidat.ts --input "<path>/…AİDAT LİSTESİ.xlsx" [--sheet "2026 - 2027"] [--out <path>]`

**CSV columns:**

| Column | Rule |
|--------|------|
| `source_row` | Excel row number (1-indexed) for human cross-reference |
| `full_name` | col A, trimmed |
| `parent_name` | col B verbatim (both parents); blank → flagged empty |
| `phone` | recovered E.164 (§5) or blank |
| `phone_confidence` | `high` \| `medium` \| `low` \| `` (blank = none found) |
| `phone_source` | short provenance string, e.g. `students.csv`, `chat-block`, `parent:BETÜL` |
| `program` | inferred enum (§4.1) or blank |
| `program_note` | `guess: <reason>` whenever program was inferred |
| `season` | constant `2026-2027` |
| `aidat_monthly` | monthly aidat in TL (§4.1) or blank |
| `servis_monthly` | col F in TL or blank |
| `kitap_amount` | col C in TL or blank |
| `note` | any raw text that couldn't be parsed (e.g. `23.000 Y - 28.000 TAM`), `ÜCRETSİZ`, `?` |

### 4.1 Aidat parsing + program inference

Derive **monthly aidat** from col D:
- numeric and ≥ 100 000 → treat as **annual lump** → `aidat_monthly = value / 10`.
- numeric and < 100 000 → treat as **monthly** → `aidat_monthly = value`.
- text containing `TAM` / `Y` (e.g. `23.000 Y - 28.000 TAM`) → extract both numbers;
  use the `TAM` number as `aidat_monthly`, record the raw string in `note`, and
  bias program to `tam_gun` (has an explicit full-day figure).
- `ÜCRETSİZ` / burslu / empty → `aidat_monthly` blank, raw word to `note`.

Infer **program** from monthly aidat (school year Eyl 2026→Haz 2027, 10 months).
The one labeled data point in the workbook — `23.000 Y - 28.000 TAM` — anchors the
threshold: **23 000 = yarım, 28 000 = tam**, and `250000 / 10 = 25 000 = tam`.
- text contains an explicit `TAM` figure → `tam_gun` (overrides the band below)
- monthly ≥ 25 000 → `tam_gun`
- 0 < monthly < 25 000 → `yarim_gun`
- no aidat → blank (human fills)

Every inferred program is written with `program_note = guess: …`. The inference is
acknowledged low-confidence; the CSV review step is where the human corrects it.
Note: on this roster that means the three plain-`23000` rows (DORA, TEOMAN, MERT)
default to `yarim_gun` — verify at review, as they may in fact be full-day.

## 5. Phone recovery

A recovery step (in the parser, or a small shared helper) builds a
name→phone pool from all available historical sources and fuzzy-matches each
student, filling `phone` + `phone_confidence` + `phone_source`. Nothing is
auto-trusted: medium/low matches must be human-verified in the CSV before upload.

**Pool sources** (all local, already in the repo/adjacent):
- `scripts/seed/out/students.csv` (full_name, parent_name → phone)
- `scripts/seed/out/leads.csv` (child_name, parent_name → phone)
- `whatsapp_export/00000598-…xlsx` and `00000727-DATA KAYIT 2024-2025.xlsx`
- `whatsapp_export/*.vcf` (FN → TEL)
- `whatsapp_export/_chat.txt` (message blocks: sender + in-text phone numbers)

**Matching:** normalize Turkish casing (İ/ı/i, diacritics), tokenize. Score a
pool entry by: child surname present (+3), each parent first-name present (+2),
child first-name present (+1); accept ≥ 3. Chat blocks require surname **and** a
parent token in the same block. Phones normalized to E.164 TR mobile
(`+90 5XX…`) via `lib/phone.normalizeTurkishPhone` (reused).

**Confidence mapping:** exact full-name in a structured file → `high`; parent
full-name match in a structured file → `high`/`medium`; single-token or
chat-block match → `medium`/`low` by score. Expected yield on this roster: ~3
high, ~3 medium/low, 10 blank.

## 6. Component ② — `scripts/seed/upload-aidat.ts`

Reads the reviewed CSV and writes to local Supabase with the service-role key.
**Dry-run by default** (`--dry-run` prints planned inserts/skips, no DB client
created — same discipline as `upload.ts`). Reuses env loading, the ws shim, and
the validation helpers from `upload.ts`.

**CLI:** `npx tsx scripts/seed/upload-aidat.ts [--dry-run] [--students <path>]`

**Per row, validate then insert (skip + report on failure, never crash):**
1. **student**: require non-empty `full_name`, valid `phone`
   (`normalizeTurkishPhone`), non-empty `parent_name`, `program ∈ PROGRAMS`,
   non-empty `season`. Insert into `students`
   (`status` defaults to `aktif`). Dedupe by `phone + full_name`
   (reuse `studentDedupeKey` / `fetchExistingStudentKeys` from `upload.ts`).
2. **aidat plan** (if `aidat_monthly` present): mirror
   `actions/payments.ts` `createPaymentPlan`:
   `totalKurus = tlToKurus(aidat_monthly * 10)`,
   `drafts = generateInstallments(totalKurus, 10, '2026-09-05')`,
   insert `payment_plans { student_id, season, item_type:'aidat',
   total_amount: kurusToTl(totalKurus), installment_count: 10 }` and 10
   `installments { due_date: draft.dueDate, amount: kurusToTl(draft.amountKurus),
   status:'bekliyor' }`.
3. **kitap plan** (if `kitap_amount` present): 1-installment `item_type:'diger'`
   plan (due at season start).
4. **servis plan** (if `servis_monthly` present): `item_type:'servis'`, 10
   monthly `bekliyor` installments. (None expected on this sheet.)

**Idempotency / rerun-safety:** dedupe students by phone+name (existing helper);
before creating a plan, skip if the student already has a `payment_plans` row for
the same `season` + `item_type`. On a successful real run, write a single
`events` marker (`entity_type:'student'`, `event_type:'seed_import'`,
`payload:{ seed:true, source:'aidat-2026-2027', count }`) — no per-row events
(historical data). Warn (don't block) if a prior `seed_import` for this source
exists.

**First due date:** `2026-09-05` (Eylül) as the anchor; `generateInstallments`
walks it forward 10 months to Haziran 2027.

## 7. Money handling

DB stores **lira** (`numeric(12,2)`); the app computes in **kuruş** and converts
at the boundary. The uploader reuses `lib/money.ts` (`tlToKurus`, `kurusToTl`) and
`lib/installments.ts` (`generateInstallments`, remainder-on-last-installment)
exactly as `actions/payments.ts` does, so imported plans are byte-for-byte
consistent with plans created in-app.

## 8. Testing (vitest, no live DB)

`tests/seed/parse-aidat.test.ts`:
- annual lump (`250000`) → `aidat_monthly = 25000`, program `tam_gun`.
- monthly (`23000`) → `aidat_monthly = 23000`.
- text `23.000 Y - 28.000 TAM` → monthly `28000`, program `tam_gun`, raw in `note`.
- `ÜCRETSİZ` / empty aidat → blank monthly + blank program, word in `note`.
- empty parent → `parent_name` blank (row still emitted, flagged).
- phone-confidence tagging: exact name → `high`; no match → blank.

`tests/seed/upload-aidat.test.ts` (build-inserts pure function, no network):
- valid row → 1 student + aidat plan (10 installments summing to total, last
  carries remainder) + kitap plan when present.
- invalid rows skipped with reasons: bad/blank phone, program not in enum, blank
  parent, blank season.
- amounts round-trip through kuruş correctly (e.g. `25000` TL → 10 × `2500.00`).

## 9. Review & operator flow

1. `parse-aidat.ts` → `out/students-2026-2027.csv`.
2. **Human review**: fill 10 missing phones, verify the 3 medium/low recovered
   phones, correct guessed programs, add missing aidat/parent where known, drop
   rows that aren't real 2026-2027 enrollees.
3. `upload-aidat.ts --dry-run` → confirm counts/skips.
4. `upload-aidat.ts` (against local) → import.
5. Manual follow-ups: set 2026-2027 `price_list` in-app; production run at handoff.

## 10. Privacy

`out/*.csv` contain real names/phones and stay gitignored
(`scripts/seed/out/`). The scripts, this spec, and tests contain **no** real
names or phone numbers. Phone numbers are never logged; skip/dedupe reports
reference `source_row` only.
