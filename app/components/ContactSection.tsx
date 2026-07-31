"use client"
import React from 'react'
import LeadForm from './LeadForm'
import ContactInfo from './ContactInfo'

const ContactSection = () => {
  return (
    <div className="bg-paper-warm py-6 md:py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-4 md:mb-10">
            <h2 className="text-xl md:text-3xl text-ink mb-1.5 md:mb-4">
              Ön Görüşme Randevusu Alın
            </h2>
            <p className="text-sm text-ink-soft md:text-base">
              Sorularınız mı var? Formu doldurarak bize ulaşabilirsiniz. En kısa sürede size geri dönüş yapacağız.
            </p>
          </div>

          <div>
            {/* Contact Form */}
            <LeadForm variant="full" />
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