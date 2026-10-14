'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Çerez tercihi"
      className="fixed inset-x-0 bottom-14 z-50 border-t border-rule bg-paper p-5 shadow-[0_-2px_16px_rgba(0,0,0,0.08)] md:bottom-0"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-ink-soft">
          Deneyiminizi iyileştirmek ve reklam performansını ölçmek için çerez kullanıyoruz.{' '}
          <Link href="/cerez" className="underline">Çerez Politikası</Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => choose('denied')}
            className="rounded-full border border-rule px-6 py-2.5 text-sm text-ink"
          >
            Reddet
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            className="rounded-full bg-ink px-6 py-2.5 text-sm text-paper"
          >
            Kabul Et
          </button>
        </div>
      </div>
    </div>
  );
}
