"use client"
import React from 'react'
import Header from '@/app/components/Header'

const KullanimPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <div className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold mb-8" style={{ color: '#071997' }}>
              Kullanım Şartları
            </h1>
            <div className="prose prose-lg">
              <p className="text-gray-700 mb-6">
                Bu sayfa şu anda hazırlanmaktadır. Kullanım şartlarımız hakkında bilgi almak için bizimle iletişime geçebilirsiniz.
              </p>
              <a 
                href="/iletisim"
                className="inline-block text-white font-medium px-6 py-3 rounded-full transition-colors duration-200 shadow-sm hover:opacity-80"
                style={{ backgroundColor: '#ef6700' }}
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

export default KullanimPage 