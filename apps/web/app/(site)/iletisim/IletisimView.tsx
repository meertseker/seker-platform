import PageHero from '@/app/components/PageHero'
import ContactSection from '@/app/components/ContactSection'
import JsonLd from '@/app/components/JsonLd'
import { buildBreadcrumbSchema } from '@/lib/schema'
import { makeReader, pickData } from '@/lib/content/reader'
import type { ReaderData } from '@/lib/content/types'

export default function IletisimView({ data }: { data: ReaderData }) {
  const c = makeReader(data)
  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'İletişim', path: '/iletisim' },
        ])}
      />

      <PageHero
        c={c}
        keys={{ eyebrow: 'iletisim.hero.eyebrow', title: 'iletisim.hero.title', lead: 'iletisim.hero.lead' }}
        tone="sky"
        scallopTone="paper-warm"
      />

      <ContactSection
        data={pickData(data, ['iletisim.contact.', 'chrome.contact.', 'site.', 'form.'])}
        keyPrefix="iletisim.contact."
      />
    </div>
  )
}
