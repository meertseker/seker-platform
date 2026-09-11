"use client"
import React from 'react'
import Header from '@/app/components/Header'
import PageHero from '@/app/components/PageHero'
import ContactSection from '@/app/components/ContactSection'

const IletisimPage = () => {
  return (
    <div className="min-h-screen bg-paper">
      <Header />

      <PageHero
        eyebrow="İletişim"
        title="Bize ulaşın"
        lead="Formu doldurun, telefon edin ya da WhatsApp'tan yazın — okul yönetimimiz ortalama 15 dakika içinde dönüş yapıyor."
        tone="sky"
        scallopTone="paper-warm"
      />

      <ContactSection />
    </div>
  )
}

export default IletisimPage
