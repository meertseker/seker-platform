"use client"
import React from 'react'
import LeadForm from './LeadForm'
import ContactInfo from './ContactInfo'
import Timecode from './cine/Timecode'
import { Editable } from './edit/Editable'
import { makeReader } from '@/lib/content/reader'
import type { ReaderData } from '@/lib/content/types'

// İstemci bileşen: sunucu ebeveyn pickData(data, [keyPrefix, 'chrome.contact.', 'site.', 'form.']) geçirir.
// keyPrefix: bölüm metinlerinin anahtar öneki; ana sayfa ve iletişim sayfası ayrı anahtarları düzenler.
const ContactSection = ({ data, keyPrefix = 'home.contact.' }: { data: ReaderData; keyPrefix?: string }) => {
  const c = makeReader(data)
  return (
    <div className="relative overflow-hidden bg-paper-warm py-6 md:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="confetti-float absolute -right-12 top-10 h-40 w-40 rounded-full bg-grape/10" />
        <span className="confetti-float absolute -left-10 bottom-16 h-32 w-32 rounded-full bg-sunny/15" />
      </div>
      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-4 md:mb-10">
            <Timecode editAttrs={c.attrs(`${keyPrefix}eyebrow`)}>{c.text(`${keyPrefix}eyebrow`)}</Timecode>
            <Editable c={c} k={`${keyPrefix}title`} as="h2" className="mt-1.5 text-xl text-ink md:mt-2 md:mb-4 md:text-3xl" />
            <Editable c={c} k={`${keyPrefix}lead`} as="p" className="text-sm text-ink-soft md:text-base" />
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-ink/5 md:p-8">
            {/* Contact Form */}
            <LeadForm data={data} />
          </div>

          {/* Contact Info */}
          <div className="mt-12">
            <ContactInfo data={data} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactSection 