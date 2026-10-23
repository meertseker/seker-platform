'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isPreviewPath } from '@/lib/previewPath';
import { classifyEntrySource, deviceFromUserAgent, isEntrance, type VisitPayload } from '@/lib/visits';

/**
 * Çerezsiz anonim ziyaret sayacı. Çerez, depolama veya kimlik kullanmaz; bu yüzden çerez onayından bağımsız çalışır.
 * İlk sayfa yönlendiren adrese göre "giriş" sayılır; sonraki sayfa geçişleri "site_ici" olarak gider.
 */
export default function VisitBeacon() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!pathname) return;
    // Gizli reklam sayfası önizlemesi sayılmaz (token site_visits'e gitmez).
    if (isPreviewPath(pathname)) return;
    // Öğretmen siteyi düzenlerken gezintisi sayılmaz.
    if (document.body.classList.contains('seker-editing')) return;

    const host = window.location.host;
    let payload: VisitPayload;
    if (first.current) {
      first.current = false;
      const entrance = isEntrance(document.referrer, host);
      payload = {
        p: pathname,
        s: entrance ? classifyEntrySource(new URLSearchParams(window.location.search), document.referrer, host) : 'site_ici',
        d: deviceFromUserAgent(navigator.userAgent),
        e: entrance,
      };
    } else {
      payload = { p: pathname, s: 'site_ici', d: deviceFromUserAgent(navigator.userAgent), e: false };
    }

    const body = JSON.stringify(payload);
    try {
      if (!navigator.sendBeacon?.('/api/v', new Blob([body], { type: 'text/plain' }))) {
        void fetch('/api/v', { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch {
      // sayaç ziyaretçiyi asla etkilemez
    }
  }, [pathname]);

  return null;
}
