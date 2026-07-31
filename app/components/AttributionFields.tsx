'use client';
import { useEffect, useState } from 'react';
import { parseAttribution, persistAttribution, type Attribution } from '@/lib/attribution';

export default function AttributionFields() {
  const [attribution, setAttribution] = useState<Attribution>({ gclid: '', landingPath: '' });

  useEffect(() => {
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
      <input type="hidden" name="landingPath" value={attribution.landingPath} readOnly />
    </>
  );
}
