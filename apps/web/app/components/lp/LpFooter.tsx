import Link from 'next/link';
import { phoneE164 } from '@/lib/site';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

/** Minimal alt bar — site menüsüne link vermez. */
export default function LpFooter({ data }: { data: ReaderData }) {
  const c = makeReader(data);
  return (
    <footer className="border-t border-rule bg-paper py-10">
      <div className="mx-auto max-w-5xl px-6 text-sm text-ink-soft">
        <p className="font-medium text-ink" {...c.attrs('site.name')}>{c.text('site.name')}</p>
        <p className="mt-2">
          {c.text('site.address.street')}, {c.text('site.address.district')}/{c.text('site.address.city')}
        </p>
        <p className="mt-1">
          <a href={`tel:${phoneE164(c)}`} className="hover:underline" {...c.attrs('site.phone')}>{c.text('site.phone')}</a>
          {' · '}
          <a href={`mailto:${c.text('site.email')}`} className="hover:underline" {...c.attrs('site.email')}>{c.text('site.email')}</a>
        </p>
        <p className="mt-4 text-xs">
          <Link href="/gizlilik" className="hover:underline" {...c.attrs('chrome.lp.footer.kvkk')}>{c.text('chrome.lp.footer.kvkk')}</Link>
          {' · '}
          <Link href="/cerez" className="hover:underline" {...c.attrs('chrome.lp.footer.cookies')}>{c.text('chrome.lp.footer.cookies')}</Link>
        </p>
      </div>
    </footer>
  );
}
