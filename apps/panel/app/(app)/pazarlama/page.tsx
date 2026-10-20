import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { istanbulDateString } from "@/lib/cron-rules";
import { normalizeRange } from "@/lib/ads/report";
import { readAdsConfig } from "@/lib/ads/config";
import { readMetaConfig } from "@/lib/ads/meta/config";
import { adsStatusLines } from "@/lib/ads/status-lines";
import { getMarketingData } from "@/lib/queries/marketing";
import { MarketingTable } from "@/components/marketing-table";
import { ConversionUploadList } from "@/components/conversion-upload-list";
import { SpendCsvForm } from "@/components/spend-csv-form";
import { SiteTrafficSection } from "@/components/site-traffic";
import { getSiteVisits, type VisitSummary } from "@/lib/queries/site-visits";
import { describeGa4Error, fetchSiteTraffic, readGa4Config, type SiteTraffic } from "@/lib/analytics/ga4";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pazarlama" };

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PazarlamaPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") redirect("/bugun");

  const params = await searchParams;
  const { from, to } = normalizeRange(first(params.bas), first(params.bit), istanbulDateString());

  const ga4 = readGa4Config();
  const [marketing, site, counter] = await Promise.allSettled([
    getMarketingData(from, to),
    ga4 ? fetchSiteTraffic(ga4, from, to) : Promise.resolve(null),
    getSiteVisits(from, to),
  ]);

  let data: Awaited<ReturnType<typeof getMarketingData>> | null = null;
  if (marketing.status === "fulfilled") data = marketing.value;
  else console.error("[pazarlama] veri okunamadı:", marketing.reason instanceof Error ? marketing.reason.name : "bilinmeyen");

  let traffic: SiteTraffic | null = null;
  let trafficError: string | null = null;
  if (site.status === "fulfilled") traffic = site.value;
  else {
    console.error("[pazarlama] GA4:", site.reason instanceof Error ? site.reason.message : "bilinmeyen");
    trafficError = describeGa4Error(site.reason);
  }

  let visits: VisitSummary | null = null;
  let visitsError: string | null = null;
  if (counter.status === "fulfilled") visits = counter.value;
  else {
    console.error("[pazarlama] ziyaret sayacı:", counter.reason instanceof Error ? counter.reason.message : "bilinmeyen");
    visitsError = "Ziyaret sayacı şu an okunamadı. Daha sonra tekrar deneyin.";
  }
  const status = adsStatusLines(readAdsConfig(), readMetaConfig());

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Pazarlama</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hangi reklam ve kaynak kaç aday, randevu ve kayıt getirdi.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-sm">
            <span className="block text-muted-foreground">Başlangıç</span>
            <input type="date" name="bas" defaultValue={from} className="min-h-11 rounded-xl border border-input px-3" />
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground">Bitiş</span>
            <input type="date" name="bit" defaultValue={to} className="min-h-11 rounded-xl border border-input px-3" />
          </label>
          <button type="submit" className="min-h-11 cursor-pointer rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Göster</button>
        </form>
      </div>

      <ul className="space-y-1 rounded-2xl border border-border bg-warning-soft p-4 text-sm text-foreground">
        <li><span className="font-semibold">Harcama:</span> {status.spend}</li>
        <li><span className="font-semibold">Dönüşüm bildirimi:</span> {status.conversion}</li>
        <li><span className="font-semibold">Instagram harcaması:</span> {status.metaSpend}</li>
        <li><span className="font-semibold">Instagram dönüşüm bildirimi:</span> {status.metaConversion}</li>
        <li><span className="font-semibold">Site ziyaretleri:</span> {ga4 ? "Google Analytics bağlı" : "Google Analytics bağlantısı yok"}</li>
      </ul>

      {data ? (
        <>
          <MarketingTable report={data.report} />

          <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Reklam platformlarına bildirilen başvuru, randevu ve kayıtlar</h2>
            <p className="text-sm text-muted-foreground">
              Reklamdan gelen bir veli başvurduğunda, randevuya veya kayda dönünce geldiği reklam platformuna bildirilir. Böylece platform kayıt olan veliye benzeyenleri bulmayı öğrenir.
              Instagram (Meta) bildirimi hukuk onayı gelene kadar kapalıdır.
            </p>
            <ConversionUploadList uploads={data.uploads} />
          </section>
        </>
      ) : (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Pazarlama verileri şu an okunamadı. Lütfen sayfayı yenileyin; sorun sürerse daha sonra tekrar deneyin.
        </p>
      )}

      <SiteTrafficSection visits={visits} visitsError={visitsError} traffic={traffic} error={trafficError} />

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Harcamayı elle yükle</h2>
        <p className="text-sm text-muted-foreground">
          Google Ads → Raporlar → Kampanyalar; &quot;Gün&quot; segmenti ve Gün, Kampanya kimliği, Kampanya, Maliyet, Tıklamalar, Gösterimler kolonlarıyla CSV indirin.
          Aynı gün tekrar yüklenirse üzerine yazılır.
        </p>
        <SpendCsvForm />
      </section>
    </div>
  );
}
