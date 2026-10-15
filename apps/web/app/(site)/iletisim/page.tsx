import IletisimView from './IletisimView'
import { buildMetadata } from '@/lib/metadata'
import { getReaderData } from '@/lib/content/server'
import { makeReader } from '@/lib/content/reader'

export async function generateMetadata() {
  const c = makeReader(await getReaderData())
  // Açıklama site.* alanlarından üretilir: okul bilgileri değişince kendiliğinden güncellenir (metin varsayılanda aynen eskisi gibi).
  const hours = `${c.text('site.hours.full.opens')}–${c.text('site.hours.full.closes')}`
  return buildMetadata({
    title: c.text('meta.iletisim.title'),
    description: `${c.text('site.name')} iletişim: ${c.text('site.address.street')}, ${c.text('site.address.district')}. Telefon ${c.text('site.phone')}. Hafta içi ${hours} açığız.`,
    path: '/iletisim',
  })
}

export default async function IletisimPage() {
  return <IletisimView data={await getReaderData()} />
}
