import Image from 'next/image';
import { phoneE164 } from '@/lib/site';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

/** Menüsüz üst bar — landing page'de kaçış yolu bırakılmaz. */
export default function LpHeader({ data }: { data: ReaderData }) {
  const c = makeReader(data);
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-2.5 sm:px-6 md:py-3.5">
        <span className="flex items-center gap-3">
          <Image src="/logo.png" alt={c.text('site.name')} width={40} height={40} className="h-9 w-9 md:h-10 md:w-10" />
          <span className="font-display text-[1.0625rem] leading-tight text-ink md:text-lg" {...c.attrs('site.name')}>{c.text('site.name')}</span>
        </span>
        <a href={`tel:${phoneE164(c)}`} className="shrink-0 text-sm font-semibold text-ink hover:underline" {...c.attrs('site.phone')}>
          {c.text('site.phone')}
        </a>
      </div>
    </header>
  );
}
