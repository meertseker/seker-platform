// Ayarlar'daki bağlantı kartlarının durumu (spec Z6, §5). Tek fonksiyon: Ayarlar, içerik panosu ve sabah cron'u
// aynı sonucu okur. Asla fırlatmaz; her Meta çağrısı kendi try'ında. Anahtar ya da gizli değer içermez.
import { readAdsConfig } from "./config";
import { fetchAdAccount, fetchFacebookPage, fetchIgUsername, fetchPixelName } from "./meta/account";
import { igPublishEnabled, readMetaConfig } from "./meta/config";
import { MetaApiError } from "./meta/insights";
import { getPublishingLimit } from "./meta/publish";
import type { FetchFn } from "./types";
import { igErrorText } from "@/lib/content/publish-queue";

export type ConnectionState = "ok" | "warn" | "bad" | "off";
export type ConnectionKey =
  | "instagram"
  | "facebook"
  | "reklam_hesabi"
  | "piksel"
  | "capi"
  | "canli_yazim"
  | "icerik_yayini"
  | "google";
export type ConnectionRow = { key: ConnectionKey | string; title: string; detail: string; state: ConnectionState; label: string };
export type ConnectionSnapshot = {
  checkedAt: string;
  rows: ConnectionRow[];
  igUsername: string | null;
  publishLimit: { used: number; total: number; remaining: number } | null;
  /** Instagram ve Facebook satırları yeşil. */
  igReady: boolean;
};

export const CONNECTIONS_KEY = "baglanti_durumu";
export const SNAPSHOT_TTL_MS = 15 * 60_000;

const ACCOUNT_STATUS: Record<number, string> = {
  1: "Etkin",
  2: "Kapalı",
  3: "Ödeme bekliyor",
  7: "Risk incelemesi",
  9: "Ek süre",
  101: "Kapatıldı",
};

/** Sayfa/hesap/piksel okumalarının Türkçe kısa sebebi. */
function readErrorText(err: unknown): string {
  if (err instanceof MetaApiError) {
    if (err.code === 190) return "Meta anahtarı geçersiz ya da süresi dolmuş (Mert)";
    if (err.code === 10 || err.code === 200) return "İzin yok · Mert";
    return "Okunamadı";
  }
  return "Meta'ya ulaşılamadı";
}

function off(key: ConnectionKey, title: string, envName: string): ConnectionRow {
  return { key, title, detail: `Kurulmadı · ${envName}`, state: "off", label: "Kurulmadı" };
}

export async function checkConnections(deps: {
  env: Record<string, string | undefined>;
  fetchFn?: FetchFn;
  now: Date;
}): Promise<ConnectionSnapshot> {
  const { env, now } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const cfg = readMetaConfig(env);
  const rows: ConnectionRow[] = [];
  let igUsername: string | null = null;
  let publishLimit: ConnectionSnapshot["publishLimit"] = null;

  // Instagram hesabı
  if (!env.META_INSTAGRAM_USER_ID?.trim()) rows.push(off("instagram", "Instagram hesabı", "META_INSTAGRAM_USER_ID"));
  else if (!cfg?.instagramUserId) rows.push(off("instagram", "Instagram hesabı", "META_ACCESS_TOKEN"));
  else {
    try {
      igUsername = await fetchIgUsername(cfg, fetchFn);
      try {
        publishLimit = await getPublishingLimit(cfg, fetchFn);
        rows.push({
          key: "instagram",
          title: "Instagram hesabı",
          detail: `@${igUsername} · içerik yayınlama izni · bugün kalan hak ${publishLimit.remaining}/${publishLimit.total}`,
          state: "ok",
          label: "Bağlı",
        });
      } catch {
        rows.push({
          key: "instagram",
          title: "Instagram hesabı",
          detail: `@${igUsername} · içerik yayınlama izni yok (instagram_content_publish)`,
          state: "bad",
          label: "İzin yok",
        });
      }
    } catch (err) {
      rows.push({ key: "instagram", title: "Instagram hesabı", detail: igErrorText(err), state: "bad", label: "Hata" });
    }
  }

  // Facebook sayfası
  const pageId = env.META_FACEBOOK_PAGE_ID?.trim();
  if (!pageId) rows.push(off("facebook", "Facebook sayfası", "META_FACEBOOK_PAGE_ID"));
  else if (!cfg) rows.push(off("facebook", "Facebook sayfası", "META_ACCESS_TOKEN"));
  else {
    try {
      const page = await fetchFacebookPage(cfg, pageId, fetchFn);
      const linked = !!cfg.instagramUserId && page.instagramId === cfg.instagramUserId;
      rows.push(
        linked
          ? { key: "facebook", title: "Facebook sayfası", detail: `${page.name} · Instagram'a bağlı`, state: "ok", label: "Bağlı" }
          : {
              key: "facebook",
              title: "Facebook sayfası",
              detail: `${page.name} · bu Instagram hesabına bağlı değil`,
              state: "bad",
              label: "Bağlı değil",
            },
      );
    } catch (err) {
      rows.push({ key: "facebook", title: "Facebook sayfası", detail: readErrorText(err), state: "bad", label: "Hata" });
    }
  }

  // Meta reklam hesabı
  if (!cfg) rows.push(off("reklam_hesabi", "Meta reklam hesabı", "META_AD_ACCOUNT_ID"));
  else {
    try {
      const acc = await fetchAdAccount(cfg, fetchFn);
      rows.push(
        acc.accountStatus === 1
          ? { key: "reklam_hesabi", title: "Meta reklam hesabı", detail: `${cfg.adAccountId} · ${acc.currency}`, state: "ok", label: "Sağlıklı" }
          : {
              key: "reklam_hesabi",
              title: "Meta reklam hesabı",
              detail: `Durum: ${ACCOUNT_STATUS[acc.accountStatus] ?? String(acc.accountStatus)}`,
              state: "bad",
              label: "Sorunlu",
            },
      );
    } catch (err) {
      rows.push({ key: "reklam_hesabi", title: "Meta reklam hesabı", detail: readErrorText(err), state: "bad", label: "Hata" });
    }
  }

  // Piksel
  if (!env.META_PIXEL_ID?.trim() || !cfg?.pixelId) rows.push(off("piksel", "Piksel", "META_PIXEL_ID"));
  else {
    try {
      const name = await fetchPixelName(cfg, fetchFn);
      rows.push({ key: "piksel", title: "Piksel", detail: name, state: "ok", label: "Bağlı" });
    } catch {
      rows.push({ key: "piksel", title: "Piksel", detail: "Kimlik var, okunamadı", state: "warn", label: "Okunamadı" });
    }
  }

  rows.push(
    cfg?.capiEnabled
      ? { key: "capi", title: "Conversions API", detail: "Sunucudan olay gönderimi açık", state: "ok", label: "Açık" }
      : { key: "capi", title: "Conversions API", detail: "Kapalı (META_CAPI_ENABLED)", state: "off", label: "Kapalı" },
  );
  rows.push(
    env.ADS_WRITE_ENABLED === "true"
      ? { key: "canli_yazim", title: "Canlı yazım", detail: "Panel platformda kurar ve değiştirir", state: "ok", label: "Açık" }
      : { key: "canli_yazim", title: "Canlı yazım", detail: "Panel yalnız kayda yazar, platforma gitmez", state: "warn", label: "Sadece göster" },
  );
  rows.push(
    igPublishEnabled(env)
      ? { key: "icerik_yayini", title: "İçerik yayını", detail: "Panel Reels'i Instagram'a gönderir", state: "ok", label: "Açık" }
      : { key: "icerik_yayini", title: "İçerik yayını", detail: "Yayınla kayda geçer, Instagram'a gitmez", state: "warn", label: "Kapalı" },
  );
  rows.push(
    readAdsConfig(env)
      ? { key: "google", title: "Google Ads", detail: "Harcama ve dönüşüm gönderimi", state: "ok", label: "Bağlı" }
      : off("google", "Google Ads", "GOOGLE_ADS_*"),
  );

  const ok = (k: string) => rows.find((r) => r.key === k)?.state === "ok";
  return { checkedAt: now.toISOString(), rows, igUsername, publishLimit, igReady: ok("instagram") && ok("facebook") };
}

/** app_settings'ten okunan anlık görüntü geçerli biçimdeyse döner. */
export function parseSnapshot(raw: unknown): ConnectionSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<ConnectionSnapshot>;
  if (typeof s.checkedAt !== "string" || !Array.isArray(s.rows) || typeof s.igReady !== "boolean") return null;
  return {
    checkedAt: s.checkedAt,
    rows: s.rows as ConnectionRow[],
    igUsername: typeof s.igUsername === "string" ? s.igUsername : null,
    publishLimit: s.publishLimit ?? null,
    igReady: s.igReady,
  };
}
