"use client"
import React, { useState } from 'react'
import Link from 'next/link'
import { FEATURED_FAQ } from '@/content/faq'
import { buildFaqSchema } from '@/lib/schema'
import JsonLd from './JsonLd'

const FAQSection = () => {
  const [openItems, setOpenItems] = useState<string[]>([])

  const toggleItem = (id: string) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  // Anasayfada gösterilecek önemli sorular
  const featuredFAQs = FEATURED_FAQ;

  return (
    <>
    <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-indigo-900 mb-4">
            Sık Sorulan Sorular
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Anaokulumuza dair merak ettiğiniz önemli soruların cevaplarını burada bulabilirsiniz.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="space-y-4">
            {featuredFAQs.map((faq) => (
              <div 
                key={faq.id} 
                className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
              >
                <button
                  onClick={() => toggleItem(faq.id)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
                >
                  <h3 className="text-lg font-semibold text-indigo-900 pr-4">
                    {faq.question}
                  </h3>
                  <svg 
                    className={`w-5 h-5 text-indigo-600 transform transition-transform duration-200 ${
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
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-gray-600 leading-relaxed">
                        {faq.answer}
                      </p>
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
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            Tüm Soruları Görüntüle
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 right-10 w-20 h-20 bg-yellow-400 rounded-full opacity-10"></div>
        <div className="absolute bottom-20 left-10 w-16 h-16 bg-red-500 rounded-full opacity-10"></div>
      </div>
    </section>
    <JsonLd data={buildFaqSchema(FEATURED_FAQ)} />
    </>
  )
}

export default FAQSection 