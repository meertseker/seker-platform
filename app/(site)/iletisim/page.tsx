import PageHero from '@/app/components/PageHero'
import ContactSection from '@/app/components/ContactSection'
import JsonLd from '@/app/components/JsonLd'
import { buildMetadata } from '@/lib/metadata'
import { buildBreadcrumbSchema } from '@/lib/schema'
import { SITE } from '@/lib/site'
import { FULL_DAY_LABEL, HALF_DAY_LABEL } from '@/content/program'

export const metadata = buildMetadata({
  title: 'İletişim',
  description: `Özel Şeker Anaokulu iletişim: ${SITE.address.street}, ${SITE.address.district}. Telefon ${SITE.phone.display}. Hafta içi ${FULL_DAY_LABEL} açığız.`,
  path: '/iletisim',
})

export default function IletisimPage() {
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

      <ContactSection />
    </div>
  )
}
