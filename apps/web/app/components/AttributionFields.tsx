'use client';
import { useEffect, useState } from 'react';
import { readCookie } from '@/lib/metaClick';
import { UTM_KEYS, parseAttribution, persistAttribution, type Attribution } from '@/lib/attribution';

export default function AttributionFields() {
  const [fbp, setFbp] = useState('');
  const [cookieFbc, setCookieFbc] = useState('');
  const [attribution, setAttribution] = useState<Attribution>({ gclid: '', fbclid: '', fbc: '', landingPath: '', utm: {} });

  useEffect(() => {
    try {
      setFbp(readCookie(document.cookie, '_fbp'));
      setCookieFbc(readCookie(document.cookie, '_fbc'));
    } catch {
      // Çerez okunamazsa Meta eşleşmesi zayıflar, başvuru kaybolmaz.
    }
    try {
      const parsed = parseAttribution(window.location.search, window.location.pathname);
      setAttribution(persistAttribution(window.sessionStorage, parsed));
    } catch {
      // sessionStorage erişilemiyor olabilir (gizli mod, devre dışı depolama).
      // Kaybedilen tek şey attribution — lead kaybedilmemeli.
    }
  }, []);

  return (
    <>
      <input type="hidden" name="gclid" value={attribution.gclid} readOnly />
      <input type="hidden" name="fbclid" value={attribution.fbclid} readOnly />
      <input type="hidden" name="fbc" value={cookieFbc || attribution.fbc} readOnly />
      <input type="hidden" name="fbp" value={fbp} readOnly />
      <input type="hidden" name="landingPath" value={attribution.landingPath} readOnly />
      {UTM_KEYS.map((key) => (
        <input key={key} type="hidden" name={key} value={attribution.utm[key] ?? ''} readOnly />
      ))}
    </>
  );
}
