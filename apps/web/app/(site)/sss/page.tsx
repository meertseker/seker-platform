import SSS from './SSS'
import { getReaderData } from '@/lib/content/server'
import { pickData } from '@/lib/content/reader'

// Bu sayfa daha önce <head> meta'sı taşımıyordu; bu aşamada eklenmez (F2-T15a).
export default async function SSSPage() {
  return <SSS data={pickData(await getReaderData(), ['sss.', 'faq.', 'site.'])} />
}
