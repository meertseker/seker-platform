"use client"
import React from 'react'
import { phoneE164, mapsUrl } from '@/lib/site'
import { makeReader } from '@/lib/content/reader'
import type { ReaderData } from '@/lib/content/types'

interface ContactInfoItem {
  type: 'phone' | 'email' | 'location'
  titleKey: string
  /** Değer tek bir alandan geliyorsa o alanın anahtarı; adres iki alandan birleştiği için işaretsiz kalır. */
  valueKey?: string
  value: string
  href: string
  external?: boolean
  icon: React.ReactNode
  bgColor: string
  iconColor: string
}

// İstemci bileşen: sunucu ebeveyn pickData(data, ['home.contact.', 'chrome.contact.', 'site.']) geçirir.
const ContactInfo = ({ data }: { data: ReaderData }) => {
  const c = makeReader(data)
  const contactItems: ContactInfoItem[] = [
    {
      type: 'phone',
      titleKey: 'chrome.contact.phone',
      valueKey: 'site.phone',
      value: c.text('site.phone'),
      href: `tel:${phoneE164(c)}`,
      bgColor: 'bg-grape',
      iconColor: 'text-white',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      )
    },
    {
      type: 'email',
      titleKey: 'chrome.contact.email',
      valueKey: 'site.email',
      value: c.text('site.email'),
      href: `mailto:${c.text('site.email')}`,
      bgColor: 'bg-mint-deep',
      iconColor: 'text-white',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      type: 'location',
      titleKey: 'chrome.contact.address',
      value: `${c.text('site.address.street')}\n${c.text('site.address.district')}/${c.text('site.address.city')}`,
      href: mapsUrl(c),
      external: true,
      bgColor: 'bg-bubble-deep',
      iconColor: 'text-white',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
      {contactItems.map((item, index) => (
        <div key={index} className="card-lift rounded-3xl bg-white p-6 shadow-sm ring-1 ring-rule">
          <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${item.bgColor}`}>
            <div className={item.iconColor}>
              {item.icon}
            </div>
          </div>
          <h3 className="mb-2 font-display text-lg text-ink" {...c.attrs(item.titleKey)}>{c.text(item.titleKey)}</h3>
          <a
            href={item.href}
            {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="whitespace-pre-line text-ink-soft hover:text-grape hover:underline"
            {...(item.valueKey ? c.attrs(item.valueKey) : {})}
          >
            {item.value}
          </a>
        </div>
      ))}
    </div>
  )
}

export default ContactInfo 