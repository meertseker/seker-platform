import { Editable, EditableRich } from '@/app/components/edit/Editable';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

type LegalPage = 'gizlilik' | 'kullanim' | 'cerez';

export default function LegalView({ data, page }: { data: ReaderData; page: LegalPage }) {
  const c = makeReader(data);

  if (page === 'gizlilik') {
    return (
      <div className="min-h-screen bg-paper">
        <div className="py-16">
          <div className="container mx-auto px-4 md:px-6">
            <article className="mx-auto max-w-3xl">
              <Editable c={c} k="legal.gizlilik.title" as="h1" className="mb-2 font-display text-3xl text-ink md:text-4xl" />
              {/* Birleşik metin: alanlar Sayfa ayarları'ndan düzenlenir (satırın kendisi işaretlenmez). */}
              <p className="mb-10 text-sm text-ink-soft">
                {c.text('legal.gizlilik.updatedLabel')} {c.text('legal.gizlilik.updatedOn')}
              </p>
              <EditableRich c={c} k="legal.gizlilik.body" className="legal-body legal-body-relaxed" />
            </article>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <Editable c={c} k={`legal.${page}.title`} as="h1" className="mb-8 font-display text-3xl text-ink md:text-4xl" />
            <div className="prose prose-lg">
              <EditableRich c={c} k={`legal.${page}.body`} className="legal-body mb-6 text-ink-soft" />
              <a
                href="/iletisim"
                className="inline-block rounded-full bg-grape px-6 py-3 font-semibold text-white shadow-lg shadow-grape/30 transition-colors duration-200 hover:bg-ink"
                {...c.attrs('legal.common.contactCta')}
              >
                {c.text('legal.common.contactCta')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
