"use client"
import React from 'react'
import { SITE } from '@/lib/site'

interface ContactInfoItem {
  type: 'phone' | 'email' | 'location'
  title: string
  value: string
  href: string
  icon: React.ReactNode
  bgColor: string
  iconColor: string
}

const ContactInfo = () => {
  const contactItems: ContactInfoItem[] = [
    {
      type: 'phone',
      title: 'Telefon',
      value: SITE.phone.display,
      href: `tel:${SITE.phone.e164}`,
      bgColor: 'bg-purple-100',
      iconColor: 'text-purple-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      )
    },
    {
      type: 'email',
      title: 'E-posta',
      value: SITE.email,
      href: `mailto:${SITE.email}`,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      type: 'location',
      title: 'Adres',
      value: `${SITE.address.street}\n${SITE.address.district}/${SITE.address.city}`,
      href: SITE.mapsUrl,
      bgColor: 'bg-red-100',
      iconColor: 'text-red-600',
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
        <div key={index} className="bg-white p-6 rounded-xl shadow-md">
          <div className={`w-12 h-12 ${item.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <div className={item.iconColor}>
              {item.icon}
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{item.title}</h3>
          <a href={item.href} className="text-gray-600 whitespace-pre-line hover:underline">
            {item.value}
          </a>
        </div>
      ))}
    </div>
  )
}

export default ContactInfo 