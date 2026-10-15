/**
 * Google Ads bağlantı kontrolü (canlı doğrulama). Yalnızca sahip tarafından, panel konteynerinin İÇİNDE çalıştırılır:
 *   docker compose -f /opt/seker/docker-compose.yml exec panel npx tsx scripts/ads/check.ts
 * Production değerleri apps/panel/.env dosyasına kopyalanmaz; konteynerin kendi ortam değişkenleri kullanılır.
 *
 * Güvenlik: betik hiçbir gizli değeri (token, secret, müşteri kimliği) yazdırmaz. 3. adımdaki çağrı
 * validateOnly: true ile yapılır; Data Manager hiçbir veri yazmaz. Sahte gclid ile 400 dönmesi bağlantı ve
 * yetkinin doğru olduğu anlamına gelir.
 */
import "dotenv/config";
import { readAdsConfig } from "../../lib/ads/config";
import { getAccessToken, fetchCampaignSpend } from "../../lib/ads/googleAds";
import { istanbulDaysAgo } from "../../lib/ads/sync";

async function main() {
  const cfg = readAdsConfig();
  if (!cfg) throw new Error("GOOGLE_ADS_* değişkenlerinden biri eksik");

  const token = await getAccessToken(cfg);
  console.log("1/3 OAuth: tamam");

  const rows = await fetchCampaignSpend(cfg, token, istanbulDaysAgo(7), istanbulDaysAgo(1));
  console.log(`2/3 Harcama: son 7 günde ${rows.length} kampanya-gün satırı`);

  const response = await fetch("https://datamanager.googleapis.com/v1/events:ingest", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      destinations: [
        {
          operatingAccount: { accountType: "GOOGLE_ADS", accountId: cfg.customerId },
          loginAccount: { accountType: "GOOGLE_ADS", accountId: cfg.loginCustomerId ?? cfg.customerId },
          productDestinationId: cfg.conversionActionIds.randevu,
        },
      ],
      events: [
        {
          adIdentifiers: { gclid: "TeSter-123-check" },
          eventTimestamp: new Date().toISOString().slice(0, 19) + "+00:00",
          transactionId: "check:validate-only",
          eventSource: "WEB",
        },
      ],
      validateOnly: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.text()).slice(0, 300);
  console.log(`3/3 Data Manager (validateOnly): HTTP ${response.status} ${body}`);
}

main().catch((error) => {
  console.error("HATA:", (error as Error).message);
  process.exit(1);
});
