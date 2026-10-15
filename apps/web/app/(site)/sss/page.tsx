import SSS from './SSS'
import { getReaderData } from '@/lib/content/server'
import { makeReader, pickData } from '@/lib/content/reader'
import { buildMetadata } from '@/lib/metadata'

export async function generateMetadata() {
  const c = makeReader(await getReaderData())
  return buildMetadata({
    title: c.text('meta.sss.title'),
    description: c.text('meta.sss.description'),
    path: '/sss',
  })
}

export default async function SSSPage() {
  return <SSS data={pickData(await getReaderData(), ['sss.', 'faq.', 'site.'])} />
}
