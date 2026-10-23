// Reklam kurulum eylemlerinin veri deposu: şablon, kurulum kimlikleri, ay başından Meta harcaması,
// haftalık kurulum sayısı, "zaten kuruldu ya da kuruluyor" denetimi ve Test reklamı araması.
// Yalnız gizli anahtarlı istemciyle ve requireRole("yonetici") sonrası kullanılır.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "@/lib/content/board";
import { AD_SETUP_KEY, parseAdSetup, type AdSetup } from "./ad-setup";
import { AD_TEMPLATE_KEY, parseAdTemplate, type AdTemplate, type AdTemplateInput } from "./ad-template";
import { SETUP_PENDING_ERROR } from "./setup-gate";

export type SetupStore = {
  /** Okuma hatasında atar (varsayılana düşmez). */
  template(): Promise<AdTemplate>;
  saveTemplate(v: AdTemplateInput, actorId: string, at: string): Promise<void>;
  /** Kurulum yoksa null; okuma hatasında atar ("kurulu değil" sanılıp ikinci kurulum açılmasın). */
  setup(): Promise<AdSetup | null>;
  saveSetup(s: AdSetup): Promise<void>;
  /** Ay başından bugüne (bugün dahil, İstanbul tarihi) Meta harcaması, TL (kuruşa yuvarlı). */
  monthMetaSpendTl(today: string): Promise<number>;
  objectStatus(level: "campaign" | "adset", id: string): Promise<string | null>;
  /** Aktif öğrencilerin tam adları (önkontrol ilk sözcüğü alır). */
  activeStudentNames(): Promise<string[]>;
  /** `sinceIso`'dan beri uygulanmış `reklam_kur` sayısı (haftalık sınır). */
  weekLaunches(sinceIso: string): Promise<number>;
  /**
   * Bu içerik için reklam kurulmuş ya da kuruluyor mu: uygulanmış `reklam_kur` kaydı, `sinceIso`'dan (son 10 dk)
   * beri platform yanıtı bekleyen kayıt ya da Test setinde aynı içerik kodlu reklam.
   */
  launchInFlight(contentId: string, sinceIso: string): Promise<boolean>;
  /**
   * Kampanya kurulumu yapılmış ya da sürüyor mu: uygulanmış `kampanya_kur` kaydı ya da `sinceIso`'dan (son 10 dk)
   * beri platform yanıtı bekleyen kayıt. "Sadece göster" kayıtları (`uygulanmadi_kapali`) sayılmaz.
   */
  campaignSetupInFlight(sinceIso: string): Promise<boolean>;
  /**
   * Bu Test reklamı Büyütme'ye taşınmış ya da taşınıyor mu: uygulanmış `buyutmeye_tasi` kaydı, `sinceIso`'dan
   * (son 10 dk) beri platform yanıtı bekleyen kayıt ya da Büyütme setinde aynı içerik kodlu reklam.
   */
  scaleInFlight(testAdId: string, code: string, scaleAdsetId: string, sinceIso: string): Promise<boolean>;
  testAdForCode(code: string, testAdsetId: string): Promise<TestAdRow[]>;
  /** Reklam setinde `status = ACTIVE` reklam sayısı (Z4 "<n> reklam çalışıyor"). Okuma hatasında atar. */
  activeAdsInAdset(adsetId: string): Promise<number>;
};

export type TestAdRow = {
  adId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  reviewFeedback: string | null;
};

const MICROS_PER_TL = 1_000_000;

type LogStatusRow = { status: string; error: string | null; created_at: string };

/** Uygulanmış kayıt ya da `sinceIso`'dan beri platform yanıtı bekleyen kayıt. */
function appliedOrPending(rows: LogStatusRow[], sinceIso: string): boolean {
  const since = Date.parse(sinceIso);
  return rows.some(
    (r) => r.status === "uygulandi" || (r.status === "hata" && r.error === SETUP_PENDING_ERROR && Date.parse(r.created_at) >= since),
  );
}

function must(error: { message?: string } | null): void {
  if (error) throw new Error("db");
}

export function supabaseSetupStore(db: SupabaseClient): SetupStore {
  const readSetting = async (key: string): Promise<unknown> => {
    const { data, error } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
    must(error);
    return (data as { value?: unknown } | null)?.value;
  };
  const setup = async () => parseAdSetup(await readSetting(AD_SETUP_KEY));

  return {
    template: async () => parseAdTemplate(await readSetting(AD_TEMPLATE_KEY)),

    async saveTemplate(v, actorId, at) {
      const value: AdTemplate = { ...v, updatedBy: actorId, updatedAt: at };
      const { error } = await db.from("app_settings").upsert({ key: AD_TEMPLATE_KEY, value }, { onConflict: "key" });
      must(error);
    },

    setup,

    async saveSetup(s) {
      const { error } = await db.from("app_settings").upsert({ key: AD_SETUP_KEY, value: s }, { onConflict: "key" });
      must(error);
    },

    async monthMetaSpendTl(today) {
      // lib/queries/campaigns.ts loadMonthSpend ile aynı aralık; cost_micros = TL × 1.000.000.
      const rows = await fetchAllPages<{ cost_micros: number | string }>((f, t) =>
        db
          .from("ad_spend_daily")
          .select("cost_micros")
          .eq("platform", "meta")
          .gte("date", `${today.slice(0, 7)}-01`)
          .lte("date", today)
          .order("date")
          .order("level")
          .order("object_id")
          .range(f, t),
      );
      const micros = rows.reduce((sum, r) => sum + Math.round(Number(r.cost_micros) || 0), 0);
      return Math.round(micros / (MICROS_PER_TL / 100)) / 100;
    },

    async objectStatus(level, id) {
      const { data, error } = await db
        .from("ad_objects")
        .select("status")
        .eq("platform", "meta")
        .eq("level", level)
        .eq("object_id", id)
        .maybeSingle();
      must(error);
      return (data as { status: string | null } | null)?.status ?? null;
    },

    async activeStudentNames() {
      const rows = await fetchAllPages<{ full_name: string | null }>((f, t) =>
        db.from("students").select("full_name").eq("status", "aktif").order("id").range(f, t),
      );
      return rows.map((r) => (r.full_name ?? "").trim()).filter(Boolean);
    },

    async weekLaunches(sinceIso) {
      const { count, error } = await db
        .from("ad_change_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "reklam_kur")
        .eq("status", "uygulandi")
        .gte("created_at", sinceIso);
      must(error);
      return count ?? 0;
    },

    async launchInFlight(contentId, sinceIso) {
      const { data, error } = await db
        .from("ad_change_log")
        .select("status, error, created_at")
        .eq("action", "reklam_kur")
        .eq("object_id", contentId)
        .in("status", ["uygulandi", "hata"])
        .order("created_at", { ascending: false })
        .limit(50);
      must(error);
      if (appliedOrPending((data ?? []) as LogStatusRow[], sinceIso)) return true;

      // Panel dışında (ya da kaydı kaybolmuş) kurulmuş reklam: Test setinde aynı içerik kodu.
      const content = await db.from("content_items").select("code").eq("id", contentId).maybeSingle();
      must(content.error);
      const code = (content.data as { code: string | null } | null)?.code;
      if (!code) return false;
      const current = await setup();
      if (!current) return false;
      const ads = await db
        .from("ad_objects")
        .select("object_id")
        .eq("platform", "meta")
        .eq("level", "ad")
        .eq("content_code", code)
        .eq("parent_id", current.testAdsetId)
        .limit(1);
      must(ads.error);
      return (ads.data ?? []).length > 0;
    },

    async campaignSetupInFlight(sinceIso) {
      const { data, error } = await db
        .from("ad_change_log")
        .select("status, error, created_at")
        .eq("action", "kampanya_kur")
        .in("status", ["uygulandi", "hata"])
        .order("created_at", { ascending: false })
        .limit(50);
      must(error);
      return appliedOrPending((data ?? []) as LogStatusRow[], sinceIso);
    },

    async scaleInFlight(testAdId, code, scaleAdsetId, sinceIso) {
      const { data, error } = await db
        .from("ad_change_log")
        .select("status, error, created_at")
        .eq("action", "buyutmeye_tasi")
        .eq("object_id", testAdId)
        .in("status", ["uygulandi", "hata"])
        .order("created_at", { ascending: false })
        .limit(50);
      must(error);
      if (appliedOrPending((data ?? []) as LogStatusRow[], sinceIso)) return true;
      const ads = await db
        .from("ad_objects")
        .select("object_id")
        .eq("platform", "meta")
        .eq("level", "ad")
        .eq("content_code", code)
        .eq("parent_id", scaleAdsetId)
        .limit(1);
      must(ads.error);
      return (ads.data ?? []).length > 0;
    },

    async testAdForCode(code, testAdsetId) {
      const { data, error } = await db
        .from("ad_objects")
        .select("object_id, name, status, effective_status, review_feedback")
        .eq("platform", "meta")
        .eq("level", "ad")
        .eq("content_code", code)
        .eq("parent_id", testAdsetId)
        .order("object_id");
      must(error);
      type Row = {
        object_id: string;
        name: string;
        status: string | null;
        effective_status: string | null;
        review_feedback: string | null;
      };
      return ((data ?? []) as Row[]).map((r) => ({
        adId: r.object_id,
        name: r.name,
        status: r.status,
        effectiveStatus: r.effective_status ?? null,
        reviewFeedback: r.review_feedback ?? null,
      }));
    },

    async activeAdsInAdset(adsetId) {
      const { count, error } = await db
        .from("ad_objects")
        .select("object_id", { count: "exact", head: true })
        .eq("platform", "meta")
        .eq("level", "ad")
        .eq("parent_id", adsetId)
        .eq("status", "ACTIVE");
      must(error);
      return count ?? 0;
    },
  };
}
