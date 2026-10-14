"use client"
import React, { useState } from 'react'
import PageHero from '@/app/components/PageHero'
import JsonLd from '@/app/components/JsonLd'
import { PUBLISHED_FAQ } from '@/content/faq'
import { buildFaqSchema } from '@/lib/schema'
import { SITE } from '@/lib/site'

/**
 * Bu sayfa daha önce kendi soru-cevap listesini elle taşıyordu ve içerik
 * content/faq.ts ile çelişiyordu (farklı çalışma saatleri, sitede başka
 * hiçbir yerde geçmeyen bir eğitim yaklaşımı, doğrulanmamış kadro iddiaları).
 * Artık tek kaynak content/faq.ts — bir cevap değişecekse orada değişir.
 */
const SSS = () => {
  const [openItems, setOpenItems] = useState<string[]>([])

  const toggleItem = (id: string) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <JsonLd data={buildFaqSchema(PUBLISHED_FAQ)} />

      <PageHero
        eyebrow="Sık sorulan sorular"
        title="Velilerin en çok sorduğu sorular"
        lead="Yaş grupları, çalışma saatleri, Montessori çalışması, branş dersleri ve ücret — okulu gezmeye gelmeden önce merak ettiklerinizin cevabı burada."
        tone="grape"
      />

      <div className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-4">
              {PUBLISHED_FAQ.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rule">
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors duration-200 hover:bg-paper-warm"
                  >
                    <h3 className="pr-4 text-lg font-semibold text-ink">
                      {item.question}
                    </h3>
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
                        <p className="leading-relaxed text-ink-soft">
                          {item.answer}
                        </p>
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
            <h2 className="mb-4 font-display text-2xl text-ink md:text-3xl">
              Cevabını bulamadığınız bir soru mu var?
            </h2>
            <p className="mb-6 text-ink-soft">
              Arayın ya da yazın; okulu gezmeye gelmeden önce aklınızda soru kalmasın.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={`tel:${SITE.phone.e164}`}
                className="inline-flex items-center gap-2 rounded-full bg-grape px-6 py-3 font-semibold text-white shadow-lg shadow-grape/30 transition-colors duration-200 hover:bg-ink"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {SITE.phone.display}
              </a>
              <a
                href={`mailto:${SITE.email}`}
                className="inline-flex items-center gap-2 rounded-full border-2 border-mint-deep px-6 py-3 font-semibold text-mint-deep transition-colors duration-200 hover:bg-mint-deep hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                E-posta gönderin
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SSS
