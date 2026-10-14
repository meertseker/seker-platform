import Script from 'next/script';

export default function ConsentDefaults() {
  return (
    <Script id="consent-default" strategy="beforeInteractive">
      {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('consent','default',{
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  analytics_storage:'denied',
  functionality_storage:'granted',
  security_storage:'granted',
  wait_for_update:500
});`}
    </Script>
  );
}
