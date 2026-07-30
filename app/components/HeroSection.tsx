"use client"
import React from 'react'

const HeroSection = () => {
  return (
<div
  className="relative overflow-hidden pt-16 pb-24 bg-cover bg-no-repeat"
  style={{
    backgroundImage: "url('/cocukklar.jpg')",
    backgroundPosition: "center 30%" // 100% en alt, 90% biraz yukarısı
  }}
>
      {/* Dark Overlay for better text readability */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgba(7, 25, 151, 0.8), rgba(7, 25, 151, 0.6))` }}></div>
      
      {/* Hero Content */}
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Headline */}
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Şeker Anaokulu&apos;na
            <br /> 
            Hoş Geldiniz!
          </h1>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <a href="/iletisim" className="text-white font-medium px-6 py-3 rounded-full transition-colors duration-200 min-w-36 text-center shadow-md hover:opacity-80" style={{ backgroundColor: '#ef6700' }}>
              İletişim
            </a>
            <a href="/aktiviteler" className="flex items-center justify-center gap-2 text-white font-medium transition-colors duration-200" style={{ color: '#f5da28' }}>
              <span className="flex items-center justify-center text-white rounded-full w-8 h-8" style={{ backgroundColor: '#ef6700' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </span>
              Aktivitelerimiz
            </a>
          </div>
        </div>

        {/* Decorative Elements - Floating on top of background */}
        <div className="hidden md:block">
          {/* Left decorative element */}
          <div className="absolute left-8 top-10 md:left-16 md:top-20 z-10">
            <div className="w-12 h-16 md:w-16 md:h-20">
              <div className="w-full h-full rounded-t-full" style={{ backgroundColor: '#e657a2' }}></div>
              <div className="w-8 h-4 md:w-10 md:h-6 rounded-b-lg mx-auto -mt-1" style={{ backgroundColor: '#f5da28' }}></div>
            </div>
          </div>
          
          {/* Right decorative element */}
          <div className="absolute right-16 top-24 md:right-32 md:top-16 z-10">
            <div className="w-8 h-8 md:w-12 md:h-12">
              <div className="w-full h-full rounded-full relative" style={{ backgroundColor: '#f5da28' }}>
                <div className="absolute top-0 left-1/4 w-1/2 h-full bg-black opacity-20 rounded-l-full"></div>
                <div className="absolute top-1/4 right-0 w-full h-1/2 flex justify-between">
                  <div className="w-1 h-full bg-black rounded-full opacity-30"></div>
                  <div className="w-1 h-full bg-black rounded-full opacity-30"></div>
                </div>
              </div>
              <div className="w-6 h-4 md:w-10 md:h-6 border-2 border-dashed border-l-transparent border-r-transparent border-b-transparent rounded-full mt-1 ml-4" style={{ borderTopColor: '#f5da28' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HeroSection 