import type { FetchFn } from "@/lib/ads/types";

/**
 * Site ziyaret raporu: Google Analytics 4 Data API (batchRunReports).
 * Kimlik doğrulama Google Ads ile aynı OAuth istemcisi ve refresh token'ıdır; token'ın
 * `analytics.readonly` kapsamını içermesi ve Cloud projesinde "Google Analytics Data API"nin açık olması gerekir.
 */

const TIMEOUT_MS = 15_000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ERROR_LENGTH = 300;

export interface Ga4Config {
  propertyId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** GA4_PROPERTY_ID (rakam) ve OAuth üçlüsü varsa yapılandırmayı döner; biri eksikse null (bölüm kapalı). */
export function readGa4Config(env: Record<string, string | undefined> = process.env): Ga4Config | null {
  const propertyId = (env.GA4_PROPERTY_ID ?? "").replace(/\D/g, "");
  const clientId = env.GOOGLE_ADS_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_ADS_CLIENT_SECRET?.trim() ?? "";
  const refreshToken = env.GOOGLE_ADS_REFRESH_TOKEN?.trim() ?? "";
  if (!propertyId || !clientId || !clientSecret || !refreshToken) return null;
  return { propertyId, clientId, clientSecret, refreshToken };
}

/**
 * Sitenin dataLayer'a yazdığı olaylar (apps/web/lib/analytics.ts TRACKED_EVENTS).
 * Uygulamalar ayrı paket olduğu için liste burada da tutulur; sitede olay eklenirse buraya da eklenmeli.
 */
export const SITE_EVENTS: Record<string, string> = {
  lead_submit: "Başvuru formu gönderildi",
  tel_click: "Telefona tıklandı",
  whatsapp_click: "WhatsApp'a tıklandı",
  cta_click: "Randevu butonuna tıklandı",
  tour_request: "Okul gezisi istendi",
  pricing_view: "Ücret bilgisi görüntülendi",
};

const CHANNEL_LABELS: Record<string, string> = {
  "Organic Search": "Google araması (ücretsiz)",
  "Paid Search": "Google Ads (arama reklamı)",
  Direct: "Doğrudan (adres yazarak / yer imi)",
  Referral: "Başka siteden bağlantı",
  "Organic Social": "Sosyal medya (ücretsiz)",
  "Paid Social": "Sosyal medya reklamı",
  "Organic Maps": "Google Haritalar",
  "Cross-network": "Google Ads (Performance Max)",
  Display: "Görüntülü reklam",
  Email: "E-posta",
  Unassigned: "Belirlenemedi",
};

export interface SiteTraffic {
  totals: { users: number; sessions: number; pageViews: number };
  channels: { label: string; sessions: number; users: number }[];
  pages: { path: string; views: number; users: number }[];
  events: { name: string; label: string; count: number }[];
}

export class Ga4Error extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "Ga4Error";
  }
}

interface ReportRow {
  dimensionValues?: { value?: string }[];
  metricValues?: { value?: string }[];
}

function num(row: ReportRow, i: number): number {
  return Number(row.metricValues?.[i]?.value ?? 0) || 0;
}

function dim(row: ReportRow, i: number): string {
  return row.dimensionValues?.[i]?.value ?? "";
}

async function accessToken(cfg: Ga4Config, fetchFn: FetchFn): Promise<string> {
  const response = await fetchFn("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Ga4Error(`OAuth token alınamadı: ${data.error ?? response.status}`, response.status || 500);
  }
  return data.access_token;
}

/** Tarih aralığı (YYYY-MM-DD, iki uç dahil) için ziyaret özetini tek istekte (batchRunReports) çeker. */
export async function fetchSiteTraffic(
  cfg: Ga4Config,
  from: string,
  to: string,
  fetchFn: FetchFn = fetch,
): Promise<SiteTraffic> {
  if (!YMD.test(from) || !YMD.test(to)) throw new Error("Geçersiz tarih");
  const dateRanges = [{ startDate: from, endDate: to }];
  const token = await accessToken(cfg, fetchFn);

  const response = await fetchFn(
    `https://analyticsdata.googleapis.com/v1beta/properties/${cfg.propertyId}:batchRunReports`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        requests: [
          { dateRanges, metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }] },
          {
            dateRanges,
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: [{ name: "sessions" }, { name: "activeUsers" }],
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: 10,
          },
          {
            dateRanges,
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
            orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
            limit: 10,
          },
          {
            dateRanges,
            dimensions: [{ name: "eventName" }],
            metrics: [{ name: "eventCount" }],
            dimensionFilter: {
              filter: { fieldName: "eventName", inListFilter: { values: Object.keys(SITE_EVENTS) } },
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? raw;
    } catch {
      // ham metin
    }
    throw new Ga4Error(message.slice(0, MAX_ERROR_LENGTH) || `HTTP ${response.status}`, response.status);
  }

  const data = (await response.json()) as { reports?: { rows?: ReportRow[] }[] };
  const [totals, channels, pages, events] = (data.reports ?? []).map((r) => r.rows ?? []);
  const totalRow = totals?.[0];
  const counts = new Map((events ?? []).map((row) => [dim(row, 0), num(row, 0)]));

  return {
    totals: {
      users: totalRow ? num(totalRow, 0) : 0,
      sessions: totalRow ? num(totalRow, 1) : 0,
      pageViews: totalRow ? num(totalRow, 2) : 0,
    },
    channels: (channels ?? []).map((row) => ({
      label: CHANNEL_LABELS[dim(row, 0)] ?? dim(row, 0),
      sessions: num(row, 0),
      users: num(row, 1),
    })),
    pages: (pages ?? []).map((row) => ({ path: dim(row, 0), views: num(row, 0), users: num(row, 1) })),
    events: Object.entries(SITE_EVENTS).map(([name, label]) => ({ name, label, count: counts.get(name) ?? 0 })),
  };
}

/** Kullanıcıya gösterilecek kısa Türkçe açıklama; teknik ayrıntı yalnızca sunucu günlüğüne gider. */
export function describeGa4Error(error: unknown): string {
  if (error instanceof Ga4Error) {
    if (error.status === 401 || /invalid_grant/.test(error.message)) {
      return "Google bağlantısı geçersiz (refresh token yenilenmeli).";
    }
    if (error.status === 403) {
      return "Google Analytics erişimi yok: token'da analytics.readonly izni veya Cloud projesinde Analytics Data API eksik.";
    }
  }
  return "Site ziyaret verileri şu an okunamadı. Daha sonra tekrar deneyin.";
}
