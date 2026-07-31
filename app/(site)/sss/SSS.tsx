"use client"
import React, { useState } from 'react'
import Header from '@/app/components/Header'

interface FAQItem {
  id: number
  question: string
  answer: string
}

const SSS = () => {
  const [openItems, setOpenItems] = useState<number[]>([])

  const toggleItem = (id: number) => {
    setOpenItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const faqData: FAQItem[] = [
    {
      id: 1,
      question: "Anaokulumuza kaç yaş arası çocuklar kabul edilir?",
      answer: "Şeker Anaokulu'nda 2-6 yaş arası çocukları kabul etmekteyiz. Yaş gruplarına göre sınıflarımız düzenlenmiştir ve her yaş grubuna uygun eğitim programları sunmaktayız."
    },
    {
      id: 2,
      question: "Kayıt için hangi belgeler gereklidir?",
      answer: "Kayıt için nüfus cüzdanı fotokopisi, aşı karnesi fotokopisi, 4 adet vesikalık fotoğraf, sağlık raporu ve velilerin kimlik fotokopileri gerekmektedir. Ayrıca kayıt formunu doldurmanız yeterlidir."
    },
    {
      id: 3,
      question: "Çocukların beslenme durumu nasıl sağlanır?",
      answer: "Anaokulumuza kayıtlı tüm çocuklara günlük 3 öğün (kahvaltı, öğle yemeği ve ikindi kahvaltısı) verilmektedir. Menüleri beslenme uzmanı kontrolünde hazırlanır ve dengeli beslenme prensipleri gözetilir."
    },
    {
      id: 4,
      question: "Çalışma saatleri nelerdir?",
      answer: "Anaokulumuza 07:15-19:15 saatleri arasında hizmet vermekteyiz. Tam gün ve yarım gün seçeneklerimiz mevcuttur. Yarım gün eğitim 07:15-13:00 saatleri arasındadır."
    },
    {
      id: 5,
      question: "Öğretmen kadronuz nasıldır?",
      answer: "Tüm öğretmenlerimiz okul öncesi eğitimi alanında lisans mezunudur ve minimum 5 yıl deneyimlidir. Ayrıca düzenli olarak hizmet içi eğitimler alarak kendilerini geliştirmektedirler."
    },
    {
      id: 6,
      question: "Güvenlik önlemleriniz nelerdir?",
      answer: "Anaokulumuza 24 saat güvenlik kamerası sistemi, güvenli giriş-çıkış kontrol sistemi, yangın alarm sistemi ve ilk yardım eğitimi almış personel bulunmaktadır. Ayrıca tüm alan çocuk güvenliği standartlarına uygun olarak düzenlenmiştir."
    },
    {
      id: 7,
      question: "Eğitim programınız nasıldır?",
      answer: "Montessori ve Reggio Emilia yaklaşımlarını temel alan eğitim programımız oyun temelli öğrenmeye odaklanır. Sanat, müzik, drama, fen, matematik ve dil gelişimi alanlarında aktiviteler düzenlenir. Her çocuğun bireysel gelişimi takip edilir."
    },
    {
      id: 8,
      question: "Ücretlendirme nasıl yapılır?",
      answer: "Ücretlerimiz tam gün/yarım gün seçeneğine ve yaş grubuna göre değişiklik gösterir. Detaylı ücret bilgisi için bizimle iletişime geçebilirsiniz. Kardeş indirimi ve peşin ödeme indirimleri mevcuttur."
    },
    {
      id: 9,
      question: "Çocukların gelişimi nasıl takip edilir?",
      answer: "Her çocuk için bireysel gelişim dosyası tutulur ve düzenli olarak veliler bilgilendirilir. Aylık gelişim raporları ve dönem sonu değerlendirme toplantıları yapılır. Gerektiğinde uzman psikolog desteği sağlanır."
    },
    {
      id: 10,
      question: "Etkinlik ve gezi programları var mı?",
      answer: "Yıl içinde çocukların gelişimini destekleyici çeşitli etkinlikler, gösteriler ve eğitici geziler düzenlenir. Tüm etkinlikler veli onayı alınarak ve güvenlik önlemleri alınarak gerçekleştirilir."
    },
    {
      id: 11,
      question: "Veli katılımı nasıl sağlanır?",
      answer: "Düzenli veli toplantıları, veli-öğretmen görüşmeleri ve çeşitli etkinliklerde veli katılımı sağlanır. Veliler çocuklarının eğitim sürecine aktif olarak dahil edilir ve öneriler alınır."
    }
  ]

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
            Sık Sorulan Sorular
          </h1>
          <p className="text-white text-lg opacity-90 max-w-3xl mx-auto">
            Anaokulumuza dair merak ettiğiniz soruların cevaplarını burada bulabilirsiniz. 
            Başka sorularınız için bizimle iletişime geçmekten çekinmeyin.
          </p>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-4">
              {faqData.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors duration-200 flex items-center justify-between"
                  >
                    <h3 className="text-lg font-semibold text-gray-800 pr-4">
                      {item.question}
                    </h3>
                    <div className="flex-shrink-0">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                        style={{ backgroundColor: openItems.includes(item.id) ? '#ef6700' : '#3ba4cc' }}
                      >
                        <svg 
                          className={`w-5 h-5 text-white transition-transform duration-200 ${
                            openItems.includes(item.id) ? 'rotate-45' : ''
                          }`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                    </div>
                  </button>
                  
                  {openItems.includes(item.id) && (
                    <div className="px-6 pb-4">
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-gray-700 leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contact CTA Section */}
      <div className="py-12" style={{ backgroundColor: 'rgba(7, 25, 151, 0.05)' }}>
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#071997' }}>
              Başka sorularınız mı var?
            </h2>
            <p className="text-gray-700 mb-6">
              Merak ettiğiniz herhangi bir konu varsa bizimle iletişime geçmekten çekinmeyin. 
              Size yardımcı olmaktan mutluluk duyarız.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href="tel:0530 101 88 75"
                className="inline-flex items-center gap-2 text-white font-medium px-6 py-3 rounded-full transition-colors duration-200 shadow-sm hover:opacity-80"
                style={{ backgroundColor: '#ef6700' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Bizi Arayın
              </a>
              <a 
                href="mailto:sekerakademi@gmail.com"
                className="inline-flex items-center gap-2 font-medium px-6 py-3 rounded-full border-2 transition-colors duration-200"
                style={{ 
                  borderColor: '#3ba4cc',
                  color: '#3ba4cc'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#3ba4cc';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#3ba4cc';
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                E-posta Gönderin
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SSS 