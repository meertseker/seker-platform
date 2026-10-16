import Script from 'next/script';
import { isEditing } from '@/lib/content/getContent';

/** Google Ads etiketi (gtag.js) kimliği; yalnızca AW-<rakam> biçimi kabul edilir. */
const ADS_TAG_ID = /^AW-\d+$/;

export default async function Analytics() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const rawAdsTagId = process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID?.trim() ?? '';
  const adsTagId = ADS_TAG_ID.test(rawAdsTagId) ? rawAdsTagId : '';
  if (!gtmId && !adsTagId) return null;
  // Düzenleme (draft) modunda etiketler yüklenmez: öğretmenin gezintisi ölçüme karışmasın.
  if (await isEditing()) return null;

  // Onay varsayılanları (ConsentDefaults) beforeInteractive ile önce kurulur; Google etiketi veli
  // çerezleri kabul edene kadar çerez yazmaz. GTM'e ayrıca bir Google Ads etiketi eklenirse bu değişken
  // boşaltılmalı, yoksa etiket iki kez çalışır.
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
      {adsTagId && (
        <>
          <Script
            id="google-ads-tag-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${adsTagId}`}
            strategy="afterInteractive"
          />
          <Script id="google-ads-tag" strategy="afterInteractive">
            {`window.gtag('js', new Date());
window.gtag('config', '${adsTagId}');`}
          </Script>
        </>
      )}
    </>
  );
}
