"use client"
import React from 'react'
import LeadForm from './LeadForm'
import ContactInfo from './ContactInfo'
import Timecode from './cine/Timecode'

const ContactSection = () => {
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
            <Timecode>Ön görüşme</Timecode>
            <h2 className="mt-1.5 text-xl text-ink md:mt-2 md:mb-4 md:text-3xl">
              Ön Görüşme Randevusu Alın
            </h2>
            <p className="text-sm text-ink-soft md:text-base">
              Okulu gezin, sınıfları ve bahçeleri görün, öğretmenlerimizle tanışın.
              Size uygun bir saat seçin; kayıt zorunluluğu yok.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-ink/5 md:p-8">
            {/* Contact Form */}
            <LeadForm />
          </div>

          {/* Contact Info */}
          <div className="mt-12">
            <ContactInfo />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactSection 