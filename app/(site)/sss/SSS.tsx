"use client"
import React, { useState } from 'react'
import Header from '@/app/components/Header'
import PageHero from '@/app/components/PageHero'

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
    <div className="min-h-screen bg-paper">
      <Header />

      <PageHero
        eyebrow="Sık sorulan sorular"
        title="Merak ettikleriniz"
        lead="Anaokulumuza dair merak ettiğiniz soruların cevaplarını burada bulabilirsiniz. Başka sorularınız için bizimle iletişime geçmekten çekinmeyin."
        tone="grape"
      />

      {/* FAQ Section */}
      <div className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-4">
              {faqData.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rule">
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors duration-200 hover:bg-paper-warm"
                  >
                    <h3 className="pr-4 text-lg font-semibold text-ink">
                      {item.question}
                    </h3>
                    <div className="flex-shrink-0">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
                          openItems.includes(item.id) ? 'bg-bubble' : 'bg-grape'
                        }`}
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
                      <div className="border-t border-rule pt-3">
                        <p className="leading-relaxed text-ink-soft">
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
      <div className="bg-paper-warm py-12">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="mb-4 font-display text-2xl text-ink md:text-3xl">
              Başka sorularınız mı var?
            </h2>
            <p className="mb-6 text-ink-soft">
              Merak ettiğiniz herhangi bir konu varsa bizimle iletişime geçmekten çekinmeyin. 
              Size yardımcı olmaktan mutluluk duyarız.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href="tel:0530 101 88 75"
                className="inline-flex items-center gap-2 rounded-full bg-grape px-6 py-3 font-semibold text-white shadow-lg shadow-grape/30 transition-colors duration-200 hover:bg-ink"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Bizi Arayın
              </a>
              <a 
                href="mailto:sekerakademi@gmail.com"
                className="inline-flex items-center gap-2 rounded-full border-2 border-mint-deep px-6 py-3 font-semibold text-mint-deep transition-colors duration-200 hover:bg-mint-deep hover:text-white"
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