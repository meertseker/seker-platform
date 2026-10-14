import Image from 'next/image';
import { SITE } from '@/lib/site';

/** Menüsüz üst bar — landing page'de kaçış yolu bırakılmaz. */
export default function LpHeader() {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="flex items-center gap-3">
          <Image src="/logo.png" alt={SITE.name} width={40} height={40} />
          <span className="font-display text-lg text-ink">{SITE.name}</span>
        </span>
        <a href={`tel:${SITE.phone.e164}`} className="text-sm font-medium text-ink hover:underline">
          {SITE.phone.display}
        </a>
      </div>
    </header>
  );
}
