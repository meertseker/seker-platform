'use client';
import Link from 'next/link';
import { phoneE164, whatsappUrl } from '@/lib/site';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';
import { trackEvent, type TrackedEvent } from '@/lib/analytics';

// İstemci bileşen: sunucu ebeveyn pickData(data, ['chrome.mobile.', 'site.']) geçirir.
// bookHref: reklam sayfaları (/lp/*) "#form" verir; aday nitelik sorularıyla sayfadaki formu doldurur.
export default function MobileActionBar({ data, bookHref = '/kayit' }: { data: ReaderData; bookHref?: string }) {
  const c = makeReader(data);
  const track = (event: TrackedEvent) => () => trackEvent(event, { location: 'mobile_bar' });
  const bookProps = {
    onClick: track('cta_click'),
    className: 'bg-grape py-3.5 text-center text-sm font-semibold text-white',
    ...c.attrs('chrome.mobile.book'),
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-3 border-t border-rule bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.08)] md:hidden">
      <a
        href={`tel:${phoneE164(c)}`}
        onClick={track('tel_click')}
        className="py-3.5 text-center text-sm font-medium text-ink"
        {...c.attrs('chrome.mobile.call')}
      >
        {c.text('chrome.mobile.call')}
      </a>
      <a
        href={whatsappUrl(c)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={track('whatsapp_click')}
        className="border-x border-rule py-3.5 text-center text-sm font-medium text-ink"
        {...c.attrs('chrome.mobile.whatsapp')}
      >
        {c.text('chrome.mobile.whatsapp')}
      </a>
      {bookHref.startsWith('#') ? (
        <a href={bookHref} {...bookProps}>
          {c.text('chrome.mobile.book')}
        </a>
      ) : (
        <Link href={bookHref} {...bookProps}>
          {c.text('chrome.mobile.book')}
        </Link>
      )}
    </nav>
  );
}
