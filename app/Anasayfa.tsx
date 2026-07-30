import React from 'react'
import Header from './components/Header'
import HeroSection from './components/HeroSection'
import TrustBar from './components/TrustBar'
import AboutSection from './components/AboutSection'
import FeaturesSection from './components/FeaturesSection'
import ActivitiesSection from './components/ActivitiesSection'
import FAQSection from './components/FAQSection'
import ContactSection from './components/ContactSection'
import Image from 'next/image'

const Anasayfa = () => {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <HeroSection />
      <TrustBar />
      <FeaturesSection />
      <ActivitiesSection />
      {/* About Section */}
      <div className="py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <AboutSection
            title="Minik kalpler burada büyüyor."
            description="Eğitim anlayışımız, çocukların kendi hızlarında öğrenmelerine olanak tanıyan oyun temelli ve etkileşimli bir yaklaşıma dayanır. Montessori ve Reggio Emilia yaklaşımlarından ilham alarak hazırladığımız programlarımızla çocukların zihinsel, sosyal, duygusal ve motor gelişimlerini bir bütün olarak destekliyoruz. Her gün yeni bir deneyim, yeni bir öğrenme fırsatı."
            buttonText="Daha Fazla"
            buttonLink="/hakkimizda"
            imageSrc="/asyalicocuk.png"
            imageAlt="Eğitici oyuncaklarla gülümseyen çocuk"
            imagePosition="right"
            backgroundColor="#3ba4cc"
          />
          
          {/* Center Image */}
          <div className="my-16 text-center md:hidden">
            <Image 
              src="/asyalicocuk.png" 
              alt="Çocuklar mutlu bir şekilde öğreniyor"
              className="rounded-lg shadow-lg mx-auto"
              width={300}
              height={200}
            />
          </div>
          
          <div className="mt-16">
            <AboutSection
              title="Güvenli ve sevgi dolu ortamımız."
              description="Anaokulumuzdaki her köşe, çocukların kendilerini güvende hissetmeleri için özel olarak tasarlanmıştır. Deneyimli öğretmen kadromuz ve modern eğitim anlayışımızla çocuklarınızın sosyal, duygusal ve akademik gelişimlerini destekliyoruz. Oyun alanlarımız, sanat atölyelerimiz ve kütüphanemizle çocukların hayal gücünü geliştiren bir öğrenme ortamı sunuyoruz."
              buttonText="Keşfet"
              buttonLink="/aktiviteler"
              imageSrc="/asyalicocuk.png"
              imageAlt="Güvenli oyun alanında mutlu çocuklar"
              imagePosition="left"
              backgroundColor="#e657a2"
            />
          </div>
        </div>
      </div>

      <FAQSection />
      
      <ContactSection />
    </div>
  )
}

export default Anasayfa