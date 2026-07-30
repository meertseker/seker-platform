"use client"
import React from 'react'
import LeadForm from './LeadForm'
import ContactInfo from './ContactInfo'

const ContactSection = () => {
  return (
    <div className="py-16" style={{ backgroundColor: 'rgba(245, 218, 40, 0.1)' }}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#071997' }}>
              Ön Görüşme Randevusu Alın
            </h2>
            <p className="text-gray-700">
              Sorularınız mı var? Formu doldurarak bize ulaşabilirsiniz. En kısa sürede size geri dönüş yapacağız.
            </p>
          </div>
          
          <div className="text-black">
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