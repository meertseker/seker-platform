import HakkimizdaView from './HakkimizdaView'
import { getReaderData } from '@/lib/content/server'
import { makeReader } from '@/lib/content/reader'
import { buildMetadata } from '@/lib/metadata'

export async function generateMetadata() {
  const c = makeReader(await getReaderData())
  return buildMetadata({
    title: c.text('meta.hakkimizda.title'),
    description: c.text('meta.hakkimizda.description'),
    path: '/hakkimizda',
  })
}

export default async function HakkimizdaPage() {
  return <HakkimizdaView data={await getReaderData()} />
}
