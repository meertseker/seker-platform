// AI konu önerilerini üretir ve ai_gorev_onerileri'ne yazar (sunucu; service_role istemcisi).
// Anahtar yoksa hiçbir şey yazılmaz. Hata olursa loglanır, satır "hata" olur; görev elle verilmeye devam eder.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SLOT_ORDER, type WeeklySlot } from "@/lib/content/slots";
import { buildPromptInput, SYSTEM_PROMPT } from "./gorev-girdi";
import { aiOutputSchema, cleanSuggestions, type Suggestion } from "./gorev-oneri";
import { loadPromptData } from "./gorev-veri";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
const TABLE = "ai_gorev_onerileri";
/** Bu süreden eski "hazirlaniyor" satırı yarıda kalmış sayılır. */
const STALE_RUNNING_MS = 3 * 60 * 1000;
/** Hata satırı bu süreden sonra kendiliğinden yeniden denenir ("Yeniden öner" beklemez). */
const RETRY_ERROR_MS = 60 * 60 * 1000;
/** Sunucu tarafı yedek model (fallbacks: "default") bu modellerde desteklenir. */
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

export type SlotStatus = "yok" | "hazirlaniyor" | "hazir" | "hata";
export type SlotState = { status: SlotStatus; suggestions: Suggestion[] };
export type WeekState = { enabled: boolean; slots: Record<WeeklySlot, SlotState> };

/** Claude çağrısı (testte değiştirilir): yapılandırılmış çıktının ham hali döner. */
export type ClaudeCall = (system: string, user: string) => Promise<unknown>;

type Db = Pick<SupabaseClient, "from">;
type Row = { slot: string; status: string; suggestions: unknown; updated_at: string };

export function aiEnabled(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim() !== "";
}

export function aiModel(): string {
  return (process.env.ANTHROPIC_MODEL ?? "").trim() || DEFAULT_MODEL;
}

function emptySlots(): Record<WeeklySlot, SlotState> {
  return Object.fromEntries(SLOT_ORDER.map((s): [WeeklySlot, SlotState] => [s, { status: "yok", suggestions: [] }])) as Record<WeeklySlot, SlotState>;
}

function toSuggestions(value: unknown): Suggestion[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is Suggestion =>
      !!s && typeof s.baslik === "string" && typeof s.aciklama === "string" && typeof s.dayanak === "string",
  );
}

/** Haftanın kayıtlı önerileri (oturum istemcisiyle de okunur: personel RLS). */
export async function readWeekSuggestions(db: Db, weekStart: string): Promise<Record<WeeklySlot, SlotState>> {
  const out = emptySlots();
  const { data, error } = await db.from(TABLE).select("slot, status, suggestions, updated_at").eq("week_start", weekStart);
  if (error) {
    console.error("[ai-gorev] öneriler okunamadı:", error.message);
    return out;
  }
  for (const r of (data ?? []) as Row[]) {
    if (!(SLOT_ORDER as string[]).includes(r.slot)) continue;
    out[r.slot as WeeklySlot] = { status: r.status as SlotStatus, suggestions: toSuggestions(r.suggestions) };
  }
  return out;
}

/** Varsayılan çağrı: Claude API, yapılandırılmış çıktı (zod şeması), sunucu tarafı yedek model. */
const callClaude: ClaudeCall = async (system, user) => {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 1 });
  const model = aiModel();
  const fallback = FALLBACK_MODELS.has(model);
  const res = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    output_config: { effort: "medium", format: betaZodOutputFormat(aiOutputSchema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error("model öneriyi reddetti");
  if (res.stop_reason === "max_tokens") throw new Error("çıktı yarıda kesildi");
  return res.parsed_output;
};

function needsRun(row: Row | undefined, force: boolean, nowMs: number): boolean {
  if (!row) return true;
  const age = nowMs - Date.parse(row.updated_at);
  if (row.status === "hazirlaniyor") return !(age < STALE_RUNNING_MS);
  if (force) return true;
  if (row.status === "hata") return age >= RETRY_ERROR_MS;
  return false;
}

/**
 * İstenen yuvalar için öneri üretir. Eksik, yarıda kalmış ya da eskimiş hatalı yuvalar üretilir; force hazır yuvayı da
 * yeniden üretir. Başka bir istek üretiyorsa (taze "hazirlaniyor") o yuvaya dokunulmaz. Hiçbir durumda istisna fırlatmaz.
 */
export async function generateWeekSuggestions(
  db: Db,
  opts: { weekStart: string; slots: WeeklySlot[]; now: Date; force?: boolean; call?: ClaudeCall },
): Promise<WeekState> {
  if (!aiEnabled()) return { enabled: false, slots: emptySlots() };
  const { weekStart, now } = opts;
  const nowIso = now.toISOString();
  const wanted = SLOT_ORDER.filter((s) => opts.slots.includes(s));

  let claimed: WeeklySlot[] = [];
  try {
    const { data: rows, error } = await db
      .from(TABLE)
      .select("slot, status, suggestions, updated_at")
      .eq("week_start", weekStart)
      .in("slot", wanted);
    if (error) throw new Error(error.message);
    const bySlot = new Map(((rows ?? []) as Row[]).map((r) => [r.slot, r]));
    const toRun = wanted.filter((s) => needsRun(bySlot.get(s), !!opts.force, now.getTime()));

    // Sahiplenme: yeni satır eklenir (çakışırsa başkası eklemiştir), var olan satır updated_at eşleşirse alınır.
    const fresh = toRun.filter((s) => !bySlot.has(s));
    if (fresh.length > 0) {
      const { data, error: insErr } = await db
        .from(TABLE)
        .upsert(
          fresh.map((slot) => ({ week_start: weekStart, slot, status: "hazirlaniyor", updated_at: nowIso })),
          { onConflict: "week_start,slot", ignoreDuplicates: true },
        )
        .select("slot");
      if (insErr) throw new Error(insErr.message);
      claimed.push(...((data ?? []) as { slot: WeeklySlot }[]).map((r) => r.slot));
    }
    for (const slot of toRun.filter((s) => bySlot.has(s))) {
      const { data, error: upErr } = await db
        .from(TABLE)
        .update({ status: "hazirlaniyor", updated_at: nowIso })
        .eq("week_start", weekStart)
        .eq("slot", slot)
        .eq("updated_at", bySlot.get(slot)!.updated_at)
        .select("slot");
      if (upErr) throw new Error(upErr.message);
      if ((data ?? []).length > 0) claimed.push(slot);
    }
    claimed = SLOT_ORDER.filter((s) => claimed.includes(s));

    if (claimed.length > 0) {
      const input = await loadPromptData(db, weekStart, claimed);
      const raw = await (opts.call ?? callClaude)(SYSTEM_PROMPT, buildPromptInput(input));
      const clean = cleanSuggestions(raw, input.banned);
      if (!clean) throw new Error("çıktı şemaya uymadı");
      const model = aiModel();
      for (const slot of claimed) {
        await db
          .from(TABLE)
          .update({ status: "hazir", suggestions: clean[slot], model, error: null, generated_at: nowIso, updated_at: nowIso })
          .eq("week_start", weekStart)
          .eq("slot", slot);
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 200) : "bilinmeyen";
    console.error("[ai-gorev] öneri üretilemedi:", message);
    for (const slot of claimed) {
      await db
        .from(TABLE)
        .update({ status: "hata", error: message, updated_at: nowIso })
        .eq("week_start", weekStart)
        .eq("slot", slot)
        .then(undefined, () => undefined);
    }
  }

  return { enabled: true, slots: await readWeekSuggestions(db, weekStart) };
}
