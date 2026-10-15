"use client"
import React, { useState } from 'react'
import Link from 'next/link'
import Timecode from './cine/Timecode'
import type { FaqItem } from '@/content/faq'
import { buildFaqSchema } from '@/lib/schema'
import { makeReader } from '@/lib/content/reader'
import type { ReaderData } from '@/lib/content/types'
import { Editable } from './edit/Editable'
import JsonLd from './JsonLd'

// İstemci bileşen: sunucu ebeveyn pickData(data, ['home.faq.', 'faq.']) geçirir.
const FAQSection = ({ data }: { data: ReaderData }) => {
  const c = makeReader(data)
  const [openItems, setOpenItems] = useState<string[]>([])

  const toggleItem = (id: string) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  // Anasayfada gösterilecek önemli sorular
  const featuredFAQs = c.list<FaqItem>('faq.items').filter((item) => item.ready && item.featured);

  return (
    <>
    <section className="bg-paper py-16">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="text-center mb-12">
          <Timecode editAttrs={c.attrs('home.faq.eyebrow')}>{c.text('home.faq.eyebrow')}</Timecode>
          <Editable c={c} k="home.faq.title" as="h2" className="mt-2 text-3xl text-ink md:text-4xl" />
          <Editable c={c} k="home.faq.lead" as="p" className="mx-auto mt-4 max-w-2xl text-ink-soft" />
        </div>

        {/* FAQ Items */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="space-y-4" {...c.listAttrs('faq.items')}>
            {featuredFAQs.map((faq) => (
              <div
                key={faq.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rule"
              >
                <button
                  onClick={() => toggleItem(faq.id)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left hover:bg-paper-warm"
                >
                  <Editable c={c} k="faq.items" path={`${faq.id}.question`} value={faq.question} as="h3" className="text-ink" />
                  <svg
                    className={`h-5 w-5 shrink-0 text-grape transition-transform duration-200 ${
                      openItems.includes(faq.id) ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {openItems.includes(faq.id) && (
                  <div className="px-6 pb-4">
                    <div className="border-t border-rule pt-4">
                      <Editable
                        c={c}
                        k="faq.items"
                        path={`${faq.id}.answer`}
                        value={faq.answer}
                        as="p"
                        className="text-ink-soft leading-relaxed"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Link
            href="/sss"
            className="inline-block rounded-full border-2 border-grape px-8 py-3 font-semibold text-grape hover:bg-grape hover:text-white"
            {...c.attrs('home.faq.cta')}
          >
            {c.text('home.faq.cta')}
          </Link>
        </div>
      </div>
    </section>
    <JsonLd data={buildFaqSchema(featuredFAQs)} />
    </>
  )
}

export default FAQSection
