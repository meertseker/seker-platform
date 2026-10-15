import Link from 'next/link';
import PageHero from '@/app/components/PageHero';
import { phoneE164, whatsappUrl } from '@/lib/site';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

export default function TesekkurlerView({ data }: { data: ReaderData }) {
  const c = makeReader(data);
  return (
    <div className="min-h-screen bg-paper">
      <PageHero
        c={c}
        keys={{ eyebrow: 'tesekkurler.hero.eyebrow', title: 'tesekkurler.hero.title', lead: 'tesekkurler.hero.lead' }}
        tone="mint"
      />
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-ink-soft" {...c.attrs('tesekkurler.lead')}>
          {c.text('tesekkurler.lead')}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <a
            href={`tel:${phoneE164(c)}`}
            className="rounded-full bg-grape px-8 py-4 font-semibold text-white shadow-lg shadow-grape/30 hover:bg-ink"
            {...c.attrs('site.phone')}
          >
            {c.text('site.phone')}
          </a>
          <a
            href={whatsappUrl(c)}
            className="rounded-full border-2 border-mint-deep px-8 py-4 font-semibold text-ink hover:bg-mint/10"
            {...c.attrs('tesekkurler.ctaWhatsapp')}
          >
            {c.text('tesekkurler.ctaWhatsapp')}
          </a>
        </div>
        <Link href="/" className="mt-10 inline-block font-semibold text-grape underline underline-offset-4" {...c.attrs('tesekkurler.home')}>
          {c.text('tesekkurler.home')}
        </Link>
      </main>
    </div>
  );
}
