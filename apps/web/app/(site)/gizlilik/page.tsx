"use client"
import React from 'react'

const GizlilikPage = () => {
  return (
    <div className="min-h-screen bg-paper">
      
      <div className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="mb-8 font-display text-3xl text-ink md:text-4xl">
              Gizlilik Politikası
            </h1>
            <div className="prose prose-lg">
              <p className="mb-6 text-ink-soft">
                Bu sayfa şu anda hazırlanmaktadır. Gizlilik politikamız hakkında bilgi almak için bizimle iletişime geçebilirsiniz.
              </p>
              <a 
                href="/iletisim"
                className="inline-block rounded-full bg-grape px-6 py-3 font-semibold text-white shadow-lg shadow-grape/30 transition-colors duration-200 hover:bg-ink"
              >
                İletişim
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GizlilikPage 