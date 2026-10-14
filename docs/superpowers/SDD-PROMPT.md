# Şeker Okul Platformu: execution prompt (subagent-driven)

Paste everything below the line into a fresh Claude Code session started in `C:\Users\meert\Desktop\sekeranaokuluweb`.

---

You are the controller for implementing the Şeker Okul Platformu. Use **superpowers:subagent-driven-development** to execute the plans below, one plan at a time. Talk to me (the owner) in Turkish; write code, commits and ledgers in English, UI text in Turkish.

## Source of truth

Read these yourself, once, before anything else:

1. Spec: `docs/superpowers/specs/2026-10-14-seker-platform-design.html` (binding authority)
2. Index + shared contract: `docs/superpowers/plans/2026-10-14-00-seker-platform-index.md` (names, signatures, tables, env vars, cross-phase decisions; every plan argues from it)
3. The phase plan you are currently executing (only that one)

The index is binding for anything shared across phases. If a phase plan contradicts the index, the index wins: rule on it and ledger the ruling. Never let a subagent read a whole plan file; hand it the task brief from `scripts/task-brief`.

## Order of execution

Each phase is its own SDD run with its own ledger, branch and final review:

| Run | Plan file | Notes |
|---|---|---|
| 1 | `2026-10-14-01-faz0-temel-ve-tasinma.md` | Creates the monorepo; see Bootstrap |
| 2 | `2026-10-14-02-faz1-basvuru-akisi.md` | Includes Task 6a (KVKK text) |
| 3 | `2026-10-14-05-faz4-odeme-cilasi.md` | Independent of Faz 1/2; small, do it early |
| 4 | `2026-10-14-03-faz2-yerinde-duzenleme.md` | Task 16 needs Faz 1 Task 6a merged |
| 5 | `2026-10-14-04-faz3-pazarlama.md` | Only after I confirm the Google Ads developer token is approved; until then, skip it and tell me |

After a phase's final review is clean, use superpowers:finishing-a-development-branch and **stop for my merge decision** before starting the next phase. A merge to `main` deploys to production (see below), so it is always my call.

## Bootstrap (Faz 0, Tasks 1–2)

`sekeranaokuluweb/docs` is not a git repo, so the SDD workspace scripts cannot run until the monorepo exists.

- Faz 0 Task 1 commits pending work in the two existing repos (`react-kindergarten-site` on branch `feat/website-reconstruction`, and `annem`). Before committing, show me `git status` of each and wait for my OK; some files may be personal data (WhatsApp exports, xlsx) that must not be committed.
- Faz 0 Task 2 creates `C:\Users\meert\Desktop\seker-platform` (`git init -b main`) and copies `docs/superpowers` into it.
- For these two tasks, keep the ledger at `C:\Users\meert\Desktop\seker-platform-bootstrap-ledger.md` and still use an implementer subagent and a task reviewer for each, with `git diff` files written to your scratchpad.
- After Task 2, switch to the monorepo copy of the plans (`seker-platform/docs/superpowers/plans/...`), run `scripts/sdd-workspace` on that path, start that ledger with the bootstrap ledger's lines copied in, and continue from Task 3.
- Branching: Tasks 1–2 build the initial `main` (the repo starts empty, so this is allowed). From Task 3 on, work in a worktree on `feat/faz0`. Later phases use `feat/faz1`, `feat/faz4`, `feat/faz2` and `feat/faz3`, each branched from the then-current `main`.

## Hard stops (ask me first, every time)

These are in addition to the skill's four stop classes. Never let a subagent do them; prepare the exact command or click-path, tell me what it changes, and wait:

- **`git push` to `main` or any merge into `main`.** `deploy.yml` deploys production on every push to `main`. Pushing feature branches is fine.
- Anything against the **production Supabase project**: `supabase db push`, `link`, running SQL, creating or rotating keys, running `import-old-web-leads.ts` without `--dry-run`.
- Anything on the **Lightsail server** (`ssh seker …`), `/opt/seker/.env`, `docker compose` on the server.
- **AWS console/CLI** changes: S3 buckets, IAM users and keys, Lightsail instance, static IP, snapshots.
- **DNS** changes, TTL lowering, and the production cutover (Faz 0 Task 11).
- **Shutting down or deleting** anything: Amplify app, Vercel projects (`anaokulcrm`, `seker-anaokulu-onizleme`), the old Supabase project, git branches in the old repos, the old GitHub repo (archive only, with my OK).
- **Google Ads**: account settings, conversion actions, OAuth consent screen, developer token application, the `utm_campaign={campaignid}` suffix.
- **Resend** domain verification, **GitHub** repo creation and Actions secrets.
- The **KVKK confirmation gate** (Faz 1 Task 9 Step 3b): if `[OKULDAN TEYİT ALINACAK` is still in `apps/web/content/kvkk.ts`, ask me for the four values (legal name/MERSİS, Supabase region, retention period, publish date). Never invent them.

Steps marked "(sahip)" in the plans are mine. Batch them: when you reach one, list every owner step that is due before the next code task, in one message, then wait.

## Secrets and personal data

- Never print, log, commit or paste into a subagent prompt any secret value (Supabase `sb_secret_…`, AWS keys, Resend, Google Ads tokens, `CRON_SECRET`). Refer to them by env var name only.
- Never read, copy or commit `annem/whatsapp_export/`, `*.zip`, `*.xlsx`, `.env*` files, or the lead CSV export. Subagents work with fixtures.
- Local development uses the local Supabase stack (`pnpm db:start`, Docker is installed). Tests never touch production.

## Model selection (always set `model` explicitly)

- **Implementers:** `haiku` when the brief contains the complete code (most tasks in these plans). Use `sonnet` for multi-file integration or judgment work:
  - Faz 0 Tasks 2, 5, 6, 7, 8, 9
  - Faz 2 Tasks 1, 8, 9, 10, and each page-wrapping task (11–17)
  - Faz 3 Tasks 4 and 5
- **Task reviewers and scoped re-reviews:** `sonnet`.
- **Fix rounds 4–5:** one tier above the stuck implementer.
- **Final whole-branch review of each phase:** `opus`.
- Faz 2 Task 1 (turning on `cacheComponents`) is the riskiest single task. If its tests show existing pages breaking, take the plan's documented fallback (`unstable_cache` + `updateTag`), ledger the ruling, and carry it into every later Faz 2 dispatch.

## Cross-phase decisions already made (do not reopen)

These are recorded in the index; treat them as settled, not as findings:

- `@seker/auth` has **no root export**; import from `@seker/auth/cookie`, `/server`, `/admin`, `/editor`. `@seker/shared` has a root export.
- Hosting is Lightsail + Supabase Free + S3. No Vercel, no Amplify after cutover. No `okul_id` or `sube_id` columns ("okulun ağı" is out of scope).
- Faz 3 sends `consent: { adUserData: CONSENT_GRANTED }` for every lead with `consent_at`. Leads without `consent_at` go without the field. The legal basis is the required KVKK checkbox; `KVKK_CONSENT_LABEL` is never an editable slot.
- Conversions are uploaded via the Data Manager API, and spend is read via Google Ads API `searchStream`.
- One editor plus the owner as backup. There are no per-key permissions.

## Pre-flight scan

At the start of each phase, before Task 1 of that plan, run the skill's pre-flight scan. Also check this phase's tasks against:

- the index contract: names, signatures, env vars, migration numbers `0006`–`0009`;
- what earlier phases actually produced (from `git log` and the earlier ledgers), not what their plans said they would produce.

Every plan lists facts it could not verify, under "Unverified" or "Doğrulanamayanlar". When a task depends on one, have the implementer verify it first. If it turns out false, rule, ledger, and adapt.

## Reporting to me

- No progress check-ins between tasks; run continuously within a phase.
- At each phase end: one short message in Turkish covering:
  - what shipped;
  - the full "Rulings I made" list from the ledger, each with its cost if wrong;
  - parked findings;
  - the owner steps still open;
  - the merge/deploy decision you need from me.

Start now: read the spec and the index, then begin Faz 0 with the bootstrap procedure above.
