import PageHero from '@/app/components/PageHero'
import ContactSection from '@/app/components/ContactSection'
import JsonLd from '@/app/components/JsonLd'
import { buildMetadata } from '@/lib/metadata'
import { getReaderData } from '@/lib/content/server'
import { pickData } from '@/lib/content/reader'
import { buildBreadcrumbSchema } from '@/lib/schema'
import { SITE } from '@/lib/site'
import { FULL_DAY_LABEL, HALF_DAY_LABEL } from '@/content/program'

export const metadata = buildMetadata({
  title: 'İletişim',
  description: `Özel Şeker Anaokulu iletişim: ${SITE.address.street}, ${SITE.address.district}. Telefon ${SITE.phone.display}. Hafta içi ${FULL_DAY_LABEL} açığız.`,
  path: '/iletisim',
})

// Geçici: iletişim sayfası kendi görevinde (Task 12+) sarılana kadar bölüm başlığı ana sayfa anahtarlarını okur.
export default async function IletisimPage() {
  const data = await getReaderData()
  return (
    <div className="min-h-screen bg-paper">
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Ana Sayfa', path: '/' },
          { name: 'İletişim', path: '/iletisim' },
        ])}
      />

      <PageHero
        eyebrow="İletişim"
        title="Bize ulaşın"
        lead={`Formu doldurun, telefon edin ya da WhatsApp'tan yazın. Hafta içi ${FULL_DAY_LABEL} saatleri arasında okulda oluyoruz; yarım gün programımız ${HALF_DAY_LABEL} arasında.`}
        tone="sky"
        scallopTone="paper-warm"
      />

      <ContactSection data={pickData(data, ['home.contact.', 'chrome.contact.', 'site.'])} />
    </div>
  )
}
