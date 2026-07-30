"use client"
import React from 'react'
import Header from '../components/Header'
import AboutSection from '../components/AboutSection'
import Image from 'next/image'

const HakkimizdaPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <div className="relative py-16 bg-indigo-900">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/90 to-purple-700/80"></div>
        
        {/* Dekoratif Şekiller */}
        <div className="absolute top-6 right-8 w-16 h-16 bg-yellow-400 rounded-full opacity-20"></div>
        <div className="absolute bottom-6 left-12 w-20 h-20 bg-red-500 rounded-full opacity-20"></div>
        
        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-white">
            Hakkımızda
          </h1>
          <p className="text-white text-lg opacity-90 max-w-2xl mx-auto">
            Şeker Anaokulu olarak çocuklarınızın mutlu, güvenli ve yaratıcı bir ortamda büyümesi için 2011 yılından beri faaliyetlerimiz devam etmektedir.
          </p>
        </div>
      </div>

      {/* About Content */}
      <div className="py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          {/* Mission Section */}
          <AboutSection
            title="Misyonumuz"
            description="Çocukların doğal meraklarını körükleyerek, yaratıcılıklarını geliştirmek ve sosyal becerilerini güçlendirmek. Her çocuğun bireysel özelliklerini keşfetmesine yardımcı olarak, onları hayata hazırlamak. Modern eğitim yaklaşımları ile geleneksel değerleri harmanlayarak, çocuklarımızın hem akademik hem de kişisel gelişimlerini desteklemek."
            buttonText="İletişim"
            buttonLink="/iletisim"
            imageSrc="/cocukklar.webp"
            imageAlt="Şeker Anaokulu sınıfında çocuklar"
            imagePosition="right"
            backgroundColor="#3ba4cc"
          />
          
          {/* Center Image */}
          <div className="my-16 text-center md:hidden">
            <Image
              src="/montesori.webp"
              alt="Montessori materyaliyle çalışan çocuk"
              className="rounded-lg shadow-lg mx-auto"
              width={300}
              height={200}
            />
          </div>
          
          <div className="mt-16">
            <AboutSection
              title="Vizyonumuz"
              description="Türkiye'nin en kaliteli okul öncesi eğitim kurumu olmak. Çocukların potansiyellerini en üst düzeyde kullanabilecekleri, özgüven sahibi, yaratıcı, problem çözme becerileri gelişmiş bireyler yetiştirebilmek. Ailelerin güvenle tercih ettiği, çocukların sevgi ile hatırladığı bir eğitim yuva olmak."
              buttonText="Aktivitelerimiz"
              buttonLink="/aktiviteler"
              imageSrc="/art.webp"
              imageAlt="Sanat atölyesinde çalışma"
              imagePosition="left"
              backgroundColor="#e657a2"
            />
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="py-16" style={{ backgroundColor: 'rgba(7, 25, 151, 0.05)' }}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: '#071997' }}>
              Değerlerimiz
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ef6700' }}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: '#071997' }}>Sevgi</h3>
              <p className="text-gray-600">Her çocuğa sevgi ile yaklaşır, onların duygusal ihtiyaçlarını karşılarız.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3ba4cc' }}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: '#071997' }}>Güven</h3>
              <p className="text-gray-600">Ailelerle güven ilişkisi kurarak şeffaf bir eğitim süreci yürütürüz.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e657a2' }}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: '#071997' }}>Yaratıcılık</h3>
              <p className="text-gray-600">Çocukların hayal güçlerini geliştiren yaratıcı aktiviteler düzenleriz.</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f5da28' }}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: '#071997' }}>Eğitim</h3>
              <p className="text-gray-600">Kaliteli eğitim ile çocukların gelişimini destekleriz.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HakkimizdaPage 