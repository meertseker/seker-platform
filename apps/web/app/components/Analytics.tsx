import Script from 'next/script';
import { isEditing } from '@/lib/content/getContent';

export default async function Analytics() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  if (!gtmId) return null;
  // Düzenleme (draft) modunda GTM yüklenmez: öğretmenin gezintisi ölçüme karışmasın.
  if (await isEditing()) return null;

  return (
    <Script id="gtm" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
    </Script>
  );
}
