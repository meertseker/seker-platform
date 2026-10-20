'use client';
import { useEffect } from 'react';
import { readConsent } from '@/lib/consent';
import { CONSENT_EVENT, metaPixelId } from '@/lib/metaPixel';

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push: unknown;
};
type FbWindow = Window & { fbq?: Fbq; _fbq?: Fbq };

const SCRIPT_ID = 'meta-pixel-src';

/** fbevents.js'yi bir kez ekler ve piksel kuyruğunu kurar (Meta'nın standart kurulum kodunun karşılığı). */
function loadPixel(id: string) {
  const w = window as FbWindow;
  if (document.getElementById(SCRIPT_ID) || w.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  w.fbq = fbq;
  w._fbq = fbq;
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);
  fbq('init', id);
  fbq('track', 'PageView');
}

/**
 * Onaya bağlı Meta pikseli. Kimlik boşsa hiçbir şey çizmez; onay yokken ağ isteği yapmaz.
 * Onay sonradan geri alınırsa (granted -> denied) ele alınmaz: arayüz seçimi sonradan değiştirmeye izin vermiyor.
 * Tercih değiştirme kontrolü eklenirse fbq('consent','revoke') çağrılmalıdır.
 * Düzenleme modu dışlaması sunucu sarmalayıcıda (MetaPixelGate).
 */
export default function MetaPixel() {
  const id = metaPixelId();

  useEffect(() => {
    if (!id) return;
    const tryLoad = () => {
      try {
        if (readConsent(window.localStorage) === 'granted') loadPixel(id);
      } catch {
        // Depolama kapalıysa piksel yüklenmez.
      }
    };
    tryLoad();
    const onConsent = (e: Event) => {
      if ((e as CustomEvent).detail === 'granted') tryLoad();
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, [id]);

  return null;
}

