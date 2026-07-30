'use client';
import Link from 'next/link';
import { SITE, WHATSAPP_URL } from '@/lib/site';
import { trackEvent, type TrackedEvent } from '@/lib/analytics';

export default function MobileActionBar() {
  const track = (event: TrackedEvent) => () => trackEvent(event, { location: 'mobile_bar' });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-3 border-t border-navy-100 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.08)] md:hidden">
      <a
        href={`tel:${SITE.phone.e164}`}
        onClick={track('tel_click')}
        className="py-3.5 text-center text-sm font-medium text-navy-900"
      >
        Ara
      </a>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={track('whatsapp_click')}
        className="border-x border-navy-100 py-3.5 text-center text-sm font-medium text-navy-900"
      >
        WhatsApp
      </a>
      <Link
        href="/kayit"
        onClick={track('cta_click')}
        className="bg-navy-900 py-3.5 text-center text-sm font-medium text-white"
      >
        Randevu
      </Link>
    </nav>
  );
}
