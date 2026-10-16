import Script from 'next/script';
import { isEditing } from '@/lib/content/getContent';

/** gtag.js ile yüklenen Google etiketleri: Google Ads (AW-<rakam>) ve Google Analytics 4 (G-<harf/rakam>). */
const ADS_TAG_ID = /^AW-\d+$/;
const GA4_ID = /^G-[A-Z0-9]+$/;

function validId(raw: string | undefined, pattern: RegExp): string {
  const value = raw?.trim() ?? '';
  return pattern.test(value) ? value : '';
}

export default async function Analytics() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const gtagIds = [
    validId(process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID, ADS_TAG_ID),
    validId(process.env.NEXT_PUBLIC_GA4_ID, GA4_ID),
  ].filter(Boolean);
  if (!gtmId && gtagIds.length === 0) return null;
  // Düzenleme (draft) modunda etiketler yüklenmez: öğretmenin gezintisi ölçüme karışmasın.
  if (await isEditing()) return null;

  // Onay varsayılanları (ConsentDefaults) beforeInteractive ile önce kurulur; Google etiketleri veli
  // çerezleri kabul edene kadar çerez yazmaz. GTM'e ayrıca Google Ads/GA4 etiketi eklenirse ilgili
  // değişken boşaltılmalı, yoksa etiket iki kez çalışır.
  return (
    <>
      {gtmId && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}
      {gtagIds.length > 0 && (
        <>
          <Script
            id="google-tag-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagIds[0]}`}
            strategy="afterInteractive"
          />
          <Script id="google-tag" strategy="afterInteractive">
            {`window.gtag('js', new Date());
${gtagIds.map((id) => `window.gtag('config', '${id}');`).join('\n')}`}
          </Script>
        </>
      )}
    </>
  );
}
