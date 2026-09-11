"use client"
import React, { useState } from 'react'
import Header from '@/app/components/Header'
import PageHero from '@/app/components/PageHero'
import Image from 'next/image';

// Define TypeScript types
type AktiviteType = {
  id: number;
  başlık: string;
  açıklama: string;
  özellikler: string[];
  yaşGrubu: string;
};

/** Kart başlık bloklarının zemin sırası — sitenin aksan renkleri. */
const BANDS = ['band-bubble', 'band-sunny', 'band-mint', 'band-sky', 'band-grape'];

type MevsimType = "kış" | "yaz";

type AktivitelerType = {
  kış: AktiviteType[];
  yaz: AktiviteType[];
};

const Aktiviteler = () => {
  // Use typed state
  const [mevsim, setMevsim] = useState<MevsimType>("kış");

  // Tüm aktiviteler
  const aktiviteler: AktivitelerType = {
    kış: [
      {
        id: 1,
        başlık: "Robotik Kodlama",
        açıklama: "Çocukların problem çözme ve mantıksal düşünme yeteneklerini geliştiren, eğlenceli robotik kodlama atölyeleri.",
        özellikler: ["Algoritmik düşünme", "Problem çözme becerileri", "Yaratıcı düşünme", "Takım çalışması"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 2,
        başlık: "Seramik",
        açıklama: "El becerilerini ve üç boyutlu düşünme yeteneğini geliştiren, çocukların kendi eserlerini yarattığı seramik atölyeleri.",
        özellikler: ["İnce motor becerileri", "Yaratıcı ifade", "Doku algısı", "Sabır ve odaklanma"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 3,
        başlık: "Görsel Sanatlar",
        açıklama: "Farklı sanat teknikleri ve malzemeleriyle çocukların kendilerini ifade etmelerini sağlayan görsel sanatlar etkinlikleri.",
        özellikler: ["Renk algısı", "Kompozisyon", "Sanatsal ifade", "El-göz koordinasyonu"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 4,
        başlık: "Bale ve Dans",
        açıklama: "Vücut koordinasyonu, ritim duygusu ve özgüven geliştiren, eğlenceli bale ve dans dersleri.",
        özellikler: ["Ritim duygusu", "Denge ve koordinasyon", "Esneklik", "Sahne özgüveni"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 5,
        başlık: "Müzik ve Ritim",
        açıklama: "Çocukların müzikal zekalarını ve ritim duygularını geliştiren, çeşitli enstrümanlarla tanıştıkları müzik dersleri.",
        özellikler: ["Ses algısı", "Ritim yeteneği", "Müzikal ifade", "Dinleme becerisi"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 6,
        başlık: "Drama",
        açıklama: "Kendini ifade etme, empati ve sosyal beceriler kazandıran, yaratıcı drama etkinlikleri.",
        özellikler: ["Empati", "Kendini ifade etme", "Rol yapma", "Sosyal beceriler"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 7,
        başlık: "Montessori Aktiviteleri",
        açıklama: "Montessori felsefesine uygun, çocukların bağımsız öğrenmelerini destekleyen, özel tasarlanmış materyallerle aktiviteler.",
        özellikler: ["Bağımsız öğrenme", "Pratik yaşam becerileri", "Düzen ve disiplin", "Odaklanma"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 8,
        başlık: "Satranç",
        açıklama: "Stratejik düşünme, planlama ve konsantrasyon becerilerini geliştiren, eğlenceli satranç dersleri.",
        özellikler: ["Stratejik düşünme", "Planlama", "Sabır", "Analitik zeka"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 9,
        başlık: "Beden Eğitimi",
        açıklama: "Çocukların fiziksel gelişimlerini destekleyen, temel motor becerileri geliştiren, eğlenceli spor etkinlikleri.",
        özellikler: ["Temel motor beceriler", "Dayanıklılık", "Koordinasyon", "Takım ruhu"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 10,
        başlık: "Beceri Koordinasyon",
        açıklama: "İnce ve kaba motor becerileri geliştiren, el-göz koordinasyonunu güçlendiren özel tasarlanmış aktiviteler.",
        özellikler: ["El-göz koordinasyonu", "Denge", "Hassas motor beceriler", "Vücut farkındalığı"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 11,
        başlık: "Psikolog ile Oyun Saati",
        açıklama: "Uzman psikolog eşliğinde, çocukların duygusal ve sosyal gelişimlerini destekleyen terapi oyunları.",
        özellikler: ["Duygusal ifade", "Sosyal beceriler", "Problem çözme", "Özgüven geliştirme"],
        yaşGrubu: "3-6 yaş"
      }
    ],
    yaz: [
      {
        id: 12,
        başlık: "Yaz Okulu Aktiviteleri",
        açıklama: "Yaz boyunca çocukların eğlenerek öğrenmeye devam etmelerini sağlayan, zengin içerikli yaz okulu programı.",
        özellikler: ["Eğlenceli öğrenme", "Sosyal etkileşim", "Yaratıcı etkinlikler", "Açık hava aktiviteleri"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 13,
        başlık: "Binicilik",
        açıklama: "Çocukların atlarla bağ kurarak sorumluluk, güven ve denge becerilerini geliştirdiği binicilik dersleri.",
        özellikler: ["Denge ve duruş", "Hayvan sevgisi", "Sorumluluk bilinci", "Özgüven"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 14,
        başlık: "Yüzme",
        açıklama: "Profesyonel eğitmenler eşliğinde, su korkusunu yenme ve temel yüzme becerilerini kazandıran yüzme dersleri.",
        özellikler: ["Su güvenliği", "Temel yüzme teknikleri", "Nefes kontrolü", "Fiziksel dayanıklılık"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 15,
        başlık: "Sportif Faaliyetler",
        açıklama: "Açık havada gerçekleştirilen, çocukların enerjilerini pozitif bir şekilde harcamalarını sağlayan çeşitli spor aktiviteleri.",
        özellikler: ["Takım çalışması", "Koordinasyon", "Motor beceriler", "Sosyal etkileşim"],
        yaşGrubu: "3-6 yaş"
      }
    ]
  };

  // Seçilen aktivite state'i
  const [seçiliAktivite, setSeçiliAktivite] = useState<AktiviteType>(aktiviteler[mevsim][0]);

  // Fonksiyonlar
  const mevsimDeğiştir = () => {
    const yeniMevsim: MevsimType = mevsim === "kış" ? "yaz" : "kış";
    setMevsim(yeniMevsim);
    setSeçiliAktivite(aktiviteler[yeniMevsim][0]);
  };

  const aktiviteSeç = (aktivite: AktiviteType) => {
    setSeçiliAktivite(aktivite);
    // Sayfayı detay bölümüne kaydır
    const detayElement = document.getElementById("aktivite-detay");
    if (detayElement) {
      detayElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div>
      <div className="min-h-screen bg-paper-warm">
        <Header />
        
        {/* Hero Section */}
        <PageHero
          eyebrow="Kış ve yaz programı"
          title="Aktivitelerimiz"
          lead="Çocuklarımızın yeteneklerini keşfetmelerini sağlayan, gelişimlerini destekleyen eğlenceli ve eğitici aktivitelerimiz."
          tone="grape"
          scallopTone="white"
        />

        {/* Mevsim Seçim Bölümü */}
        <div className="py-8 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex items-center justify-center gap-4">
              <span className={`text-lg font-medium ${mevsim === "kış" ? "text-grape font-semibold" : "text-ink-soft"}`}>Kış Dönemi</span>
              
              {/* Toggle Switch */}
              <button 
                onClick={mevsimDeğiştir} 
                className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-grape focus:ring-offset-2 ${
                  mevsim === "yaz" ? "bg-paper-warm0" : "bg-grape"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 ${
                    mevsim === "yaz" ? "translate-x-9" : "translate-x-1"
                  }`}
                />
                {/* Kış ikonu */}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`absolute left-1.5 h-4 w-4 text-white transition-opacity duration-300 ${mevsim === "kış" ? "opacity-100" : "opacity-0"}`} 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path d="M10 2a.75.75 0 01.75.75v1.077L12.416 3.3a.75.75 0 111.168.9l-1.666.75.952.952a.75.75 0 11-1.06 1.06l-.952-.952-.75 1.667a.75.75 0 11-.9-1.168l.527-1.666H8.25a.75.75 0 010-1.5h1.077L9.7 3.584a.75.75 0 01.3-1.464V2zM4.034 7.5a.75.75 0 01.282 1.024l-.834 1.875a.75.75 0 01-1.307-.731l.834-1.875a.75.75 0 011.024-.282zM4.5 13.5a.75.75 0 01.546.22l1.183 1.183a.75.75 0 01-1.061 1.061L4 14.782V17.25a.75.75 0 01-1.5 0v-3a.75.75 0 01.22-.53l1.183-1.183A.75.75 0 014.5 13.5z" />
                </svg>
                
                {/* Yaz ikonu */}
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`absolute right-1.5 h-4 w-4 text-white transition-opacity duration-300 ${mevsim === "yaz" ? "opacity-100" : "opacity-0"}`} 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                >
                  <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
                </svg>
              </button>
              
              <span className={`text-lg font-medium ${mevsim === "yaz" ? "text-tangerine-deep font-semibold" : "text-ink-soft"}`}>Yaz Dönemi</span>
            </div>
          </div>
        </div>
        
        {/* Aktivite Kartları Grid */}
        <div className="py-12 bg-paper-warm">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-ink mb-12">
              {mevsim === "kış" ? "Kış Dönemi Aktivitelerimiz" : "Yaz Dönemi Aktivitelerimiz"}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {aktiviteler[mevsim].map((aktivite, index) => (
                <div 
                  key={aktivite.id} 
                  className={`bg-white rounded-3xl shadow-sm overflow-hidden cursor-pointer transition-transform duration-300 hover:shadow-lg hover:-translate-y-1 ${seçiliAktivite.id === aktivite.id ? "ring-2 ring-grape" : ""}`}
                  onClick={() => aktiviteSeç(aktivite)}
                >
                  {/* Atölyelerin okul çekimi henüz yok; kart fotoğraf
                      yerine renkli bir başlık bloğuyla açılıyor. */}
                  <div className={`relative flex h-40 items-end p-5 ${BANDS[index % BANDS.length]}`}>
                    <div className="absolute top-3 right-3 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-ink">
                      {aktivite.yaşGrubu}
                    </div>
                    <h3 className="font-display text-2xl leading-tight text-white">{aktivite.başlık}</h3>
                  </div>
                  
                  {/* Aktivite Bilgileri */}
                  <div className="p-5">
                    <p className="text-ink-soft text-sm line-clamp-2">{aktivite.açıklama}</p>
                    
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-xs text-grape font-medium">{aktivite.özellikler.length} özellik</span>
                      <button className="text-grape hover:text-ink text-sm font-medium flex items-center gap-1">
                        Detaylar
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Seçilen Aktivite Detayları */}
        <div id="aktivite-detay" className="py-16 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="bg-white rounded-3xl shadow-lg shadow-ink/5 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Seçilen atölyenin başlık bloğu. Atölye içinden okul
                    çekimi geldiğinde buraya fotoğraf girecek. */}
                <div className="relative flex h-64 items-end p-8 md:h-auto band-grape">
                  <div className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-sm font-medium text-ink">
                    {seçiliAktivite.yaşGrubu}
                  </div>
                  <p className="font-display text-3xl leading-tight text-white md:text-4xl">
                    {seçiliAktivite.başlık}
                  </p>
                </div>
                
                {/* Aktivite Bilgileri */}
                <div className="p-6 md:p-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-ink mb-4">{seçiliAktivite.başlık}</h2>
                  <p className="text-ink-soft mb-6">{seçiliAktivite.açıklama}</p>
                  
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-ink mb-3">Kazanımlar</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {seçiliAktivite.özellikler.map((özellik, index) => (
                        <div key={index} className="flex items-center gap-2 bg-paper-warm p-3 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-grape" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className='text-ink'>{özellik}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <button className="bg-grape hover:bg-ink text-white px-6 py-2 rounded-full transition-colors flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      Bilgi Al
                    </button>
                    <button className="flex items-center gap-2 rounded-full bg-tangerine-deep px-6 py-2 text-white transition-colors hover:bg-ink">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      Kayıt Ol
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        

        
        {/* Çağrı Kartları */}
        <div className="py-12 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Aktivite Programı */}
              <div className="bg-gradient-to-br from-mint to-grape text-white rounded-3xl shadow-lg shadow-ink/5 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Aktivite Programını İndir</h3>
                  <p className="mb-4 opacity-90">Tüm aktivitelerimizin detaylı açıklamaları ve haftalık programını indirin.</p>
                  <button className="bg-white text-mint-deep font-semibold px-5 py-2 rounded-lg hover:bg-paper-warm transition-colors">
                    PDF İndir
                  </button>
                </div>
              </div>
              
              {/* İletişim */}
              <div className="bg-gradient-to-br from-grape to-ink text-white rounded-3xl shadow-lg shadow-ink/5 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Bizimle İletişime Geçin</h3>
                  <p className="mb-4 opacity-90">Sorularınız için bize ulaşın, en kısa sürede dönüş yapacağız.</p>
                  <button className="bg-white text-grape font-medium px-5 py-2 rounded-lg hover:bg-paper-warm transition-colors">
                    İletişim Formu
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* SSS Bölümü */}
        <div className="py-16 bg-paper-warm">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-ink mb-4">
                Sıkça Sorulan Sorular
              </h2>
              <p className="text-ink-soft max-w-2xl mx-auto">
                Aktivitelerimiz hakkında merak edilen soruların cevaplarını burada bulabilirsiniz.
              </p>
            </div>
            
            <div className="max-w-3xl mx-auto">
              {/* SSS Öğeleri - Accordion tarzında yapılabilir */}
              {[
                {
                  soru: "Aktivitelere hangi yaş grubu çocuklar katılabilir?",
                  cevap: "Aktivitelere genellikle 3-6 yaş arası çocuklar katılabilmektedir. Her aktivitenin kendine özel yaş aralığı bulunmaktadır ve detaylarını ilgili aktivite sayfasında görebilirsiniz."
                },
                {
                  soru: "Aktiviteler ne kadar sürüyor?",
                  cevap: "Aktivitelerimiz genellikle 30 dakika arasında sürmektedir. Çocukların dikkat süreleri ve aktivitenin içeriğine göre bu süre değişebilmektedir."
                },
                {
                  soru: "Aktiviteye katılmak için ön kayıt gerekli mi?",
                  cevap: "Evet, tüm aktivitelerimiz için ön kayıt gerekmektedir. Kontenjanlarımız sınırlı olduğundan, çocuğunuzun katılmak istediği aktivite için önceden kayıt yaptırmanızı öneririz."
                }
              ].map((item, index) => (
                <div key={index} className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-ink mb-2">{item.soru}</h3>
                    <p className="text-ink-soft">{item.cevap}</p>
                  </div>
                </div>
              ))}
              
              <div className="text-center mt-8">
                <button className="bg-grape hover:bg-ink text-white px-6 py-3 rounded-full transition-colors inline-flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  Tüm Soruları Görüntüle
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Call to Action */}
        <div className="band-grape relative overflow-hidden py-16">
          {/* Dekoratif Şekiller */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="confetti-float absolute left-8 top-12 h-24 w-24 rounded-full bg-sunny/20" />
            <span className="confetti-float absolute bottom-12 right-12 h-32 w-32 rounded-full bg-bubble/20" />
          </div>

          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Çocuğunuz İçin En İyi Başlangıç
            </h2>
            <p className="text-white text-lg opacity-90 max-w-2xl mx-auto mb-8">
              Kaliteli eğitim, uzman kadro ve modern tesislerimizle çocuğunuzun geleceğine yatırım yapın.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button className="bg-white text-ink hover:bg-paper-warm px-8 py-3 rounded-full font-medium transition-colors">
                Hemen Kayıt Ol
              </button>
              <button className="bg-transparent border-2 border-white text-white hover:bg-white/10 px-8 py-3 rounded-full font-medium transition-colors">
                İletişime Geç
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )}

  export default Aktiviteler