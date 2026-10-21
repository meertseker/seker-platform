'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CONSENT_EVENT } from '@/lib/metaPixel';
import { CONSENT_KEY, readConsent, buildConsentUpdate, type ConsentChoice } from '@/lib/consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = readConsent(window.localStorage);
    if (stored === null) {
      setVisible(true);
      return;
    }
    // Replay the stored choice: ConsentDefaults resets all four signals to
    // 'denied' on every page load, so a returning visitor's earlier choice
    // (granted or denied) must be re-asserted to gtag, or a prior "granted"
    // silently runs fully denied for the rest of the session.
    window.gtag?.('consent', 'update', buildConsentUpdate(stored));
  }, []);

  function choose(choice: ConsentChoice) {
    window.localStorage.setItem(CONSENT_KEY, choice);
    window.gtag?.('consent', 'update', buildConsentUpdate(choice));
    // Meta pikseli gibi onaya bağlı yükleyiciler seçimi buradan öğrenir.
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
    setVisible(false);
  }

  if (!visible) return null;

  // Telefonda alt çubuğun hemen üstünde ince bir şerit: metin ve iki düğme ~95 px'e sığar, reklam
  // sayfasındaki formu ve ilk ekranı kapatmaz. Seçim davranışı (choose) değişmedi.
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Çerez tercihi"
      className="fixed inset-x-0 bottom-[49px] z-50 border-t border-rule bg-paper/95 px-4 py-2.5 shadow-[0_-2px_16px_rgba(46,16,101,0.08)] backdrop-blur md:bottom-0 md:px-6 md:py-4"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-[13px] leading-snug text-ink-soft md:text-sm">
          Deneyiminizi iyileştirmek ve reklam performansını ölçmek için çerez kullanıyoruz.{' '}
          <Link href="/cerez" className="font-semibold text-ink underline">Çerez Politikası</Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose('denied')}
            className="min-h-9 flex-1 rounded-full border border-ink/25 px-5 text-sm font-semibold text-ink sm:flex-none"
          >
            Reddet
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            className="min-h-9 flex-1 rounded-full bg-ink px-5 text-sm font-semibold text-paper sm:flex-none"
          >
            Kabul Et
          </button>
        </div>
      </div>
    </div>
  );
}
