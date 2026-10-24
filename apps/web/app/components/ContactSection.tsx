import FormSection from './FormSection'
import ContactInfo from './ContactInfo'
import { makeReader } from '@/lib/content/reader'
import type { ReaderData } from '@/lib/content/types'

// Sunucu ebeveyn pickData(data, [keyPrefix, 'chrome.contact.', 'site.', 'form.']) geçirir.
// keyPrefix: bölüm metinlerinin anahtar öneki; ana sayfa ve iletişim sayfası ayrı anahtarları düzenler.
// Form bloğu sitenin ortak kalıbı (FormSection); altına telefon / e-posta / adres kartları gelir.
const ContactSection = ({ data, keyPrefix = 'home.contact.' }: { data: ReaderData; keyPrefix?: string }) => {
  const c = makeReader(data)
  return (
    <FormSection
      c={c}
      data={data}
      keys={{ eyebrow: `${keyPrefix}eyebrow`, title: `${keyPrefix}title`, lead: `${keyPrefix}lead` }}
    >
      <ContactInfo data={data} />
    </FormSection>
  )
}

export default ContactSection
