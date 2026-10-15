import Image from 'next/image';
import { phoneE164 } from '@/lib/site';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

/** Menüsüz üst bar — landing page'de kaçış yolu bırakılmaz. */
export default function LpHeader({ data }: { data: ReaderData }) {
  const c = makeReader(data);
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="flex items-center gap-3">
          <Image src="/logo.png" alt={c.text('site.name')} width={40} height={40} />
          <span className="font-display text-lg text-ink" {...c.attrs('site.name')}>{c.text('site.name')}</span>
        </span>
        <a href={`tel:${phoneE164(c)}`} className="text-sm font-medium text-ink hover:underline" {...c.attrs('site.phone')}>
          {c.text('site.phone')}
        </a>
      </div>
    </header>
  );
}
