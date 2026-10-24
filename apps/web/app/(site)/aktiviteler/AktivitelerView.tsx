import type { ReactNode } from 'react';
import PageHero from '@/app/components/PageHero';
import JsonLd from '@/app/components/JsonLd';
import FormSection from '@/app/components/FormSection';
import BranchExplorer from './BranchExplorer';
import { buildBreadcrumbSchema } from '@/lib/schema';
import { makeReader, pickData } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

/** İstemci keşfedicinin ihtiyaç duyduğu içerik dilimi (sunucu ebeveyn bunu geçirir). */
export const EXPLORER_PREFIXES = ['program.', 'aktiviteler.', 'media.'];

/**
 * `explorer`: sayfa `?ders=` parametresini okuyan Suspense sarmalını geçirir;
 * verilmezse parametresiz hâli (ilk ders seçili) basılır.
 */
export default function AktivitelerView({ data, explorer }: { data: ReaderData; explorer?: ReactNode }) {
  const c = makeReader(data);

  return (
    <div className="min-h-screen bg-paper-warm">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'Branş Dersleri', path: '/aktiviteler' },
        ])}
      />

      <PageHero
        c={c}
        keys={{ eyebrow: 'aktiviteler.hero.eyebrow', title: 'aktiviteler.hero.title', lead: 'aktiviteler.hero.lead' }}
        tone="grape"
        scallopTone="white"
      />

      {explorer ?? <BranchExplorer data={pickData(data, EXPLORER_PREFIXES)} />}

      <FormSection c={c} data={data} tone="white" keys={{ title: 'aktiviteler.cta.title', lead: 'aktiviteler.cta.lead' }} />
    </div>
  );
}
