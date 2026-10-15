"use client"
import React, { useState } from 'react'
import PageHero from '@/app/components/PageHero'
import JsonLd from '@/app/components/JsonLd'
import { Editable } from '@/app/components/edit/Editable'
import type { FaqItem } from '@/content/faq'
import { buildFaqSchema } from '@/lib/schema'
import { phoneE164 } from '@/lib/site'
import { makeReader } from '@/lib/content/reader'
import type { ReaderData } from '@/lib/content/types'

/**
 * Bu sayfa daha önce kendi soru-cevap listesini elle taşıyordu ve içerik
 * content/faq.ts ile çelişiyordu (farklı çalışma saatleri, sitede başka
 * hiçbir yerde geçmeyen bir eğitim yaklaşımı, doğrulanmamış kadro iddiaları).
 * Artık tek kaynak `faq.items` listesidir (varsayılanı content/faq.ts) — bir cevap değişecekse orada değişir.
 */
// İstemci bileşen: sunucu ebeveyn pickData(data, ['sss.', 'faq.', 'site.']) geçirir.
const SSS = ({ data }: { data: ReaderData }) => {
  const c = makeReader(data)
  const [openItems, setOpenItems] = useState<string[]>([])
  const published = c.list<FaqItem>('faq.items').filter((item) => item.ready)

  const toggleItem = (id: string) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <JsonLd data={buildFaqSchema(published.map((f) => ({ ...f, question: c.fill(f.question), answer: c.fill(f.answer) })))} />

      <PageHero
        c={c}
        keys={{ eyebrow: 'sss.hero.eyebrow', title: 'sss.hero.title', lead: 'sss.hero.lead' }}
        tone="grape"
      />

      <div className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-4" {...c.listAttrs('faq.items')}>
              {published.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rule">
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors duration-200 hover:bg-paper-warm"
                  >
                    <Editable
                      c={c}
                      k="faq.items"
                      path={`${item.id}.question`}
                      value={item.question}
                      as="h3"
                      className="pr-4 text-lg font-semibold text-ink"
                    />
                    <div className="flex-shrink-0">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
                          openItems.includes(item.id) ? 'bg-bubble' : 'bg-grape'
                        }`}
                      >
                        <svg
                          className={`w-5 h-5 text-white transition-transform duration-200 ${
                            openItems.includes(item.id) ? 'rotate-45' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {openItems.includes(item.id) && (
                    <div className="px-6 pb-4">
                      <div className="border-t border-rule pt-3">
                        <Editable
                          c={c}
                          k="faq.items"
                          path={`${item.id}.answer`}
                          value={item.answer}
                          as="p"
                          className="leading-relaxed text-ink-soft"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-paper-warm py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <Editable c={c} k="sss.cta.title" as="h2" className="mb-4 font-display text-2xl text-ink md:text-3xl" />
            <Editable c={c} k="sss.cta.lead" as="p" className="mb-6 text-ink-soft" />
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {/* Düğme yazıları simgeyle aynı elemanda: satır içi düzenleme işareti yok (telefon ve e-posta etiketi sayfa ayarlarından düzenlenir). */}
              <a
                href={`tel:${phoneE164(c)}`}
                className="inline-flex items-center gap-2 rounded-full bg-grape px-6 py-3 font-semibold text-white shadow-lg shadow-grape/30 transition-colors duration-200 hover:bg-ink"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {c.text('site.phone')}
              </a>
              <a
                href={`mailto:${c.text('site.email')}`}
                className="inline-flex items-center gap-2 rounded-full border-2 border-mint-deep px-6 py-3 font-semibold text-mint-deep transition-colors duration-200 hover:bg-mint-deep hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {c.text('sss.cta.email')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SSS
