"use client"
import React, { useState } from 'react'
import Header from '@/app/components/Header'
import Image from 'next/image';

// Define TypeScript types
type AktiviteType = {
  id: number;
  başlık: string;
  açıklama: string;
  resim: string;
  özellikler: string[];
  yaşGrubu: string;
};

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
        resim: "/robotic.webp",
        özellikler: ["Algoritmik düşünme", "Problem çözme becerileri", "Yaratıcı düşünme", "Takım çalışması"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 2,
        başlık: "Seramik",
        açıklama: "El becerilerini ve üç boyutlu düşünme yeteneğini geliştiren, çocukların kendi eserlerini yarattığı seramik atölyeleri.",
        resim: "/seramik.webp",
        özellikler: ["İnce motor becerileri", "Yaratıcı ifade", "Doku algısı", "Sabır ve odaklanma"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 3,
        başlık: "Görsel Sanatlar",
        açıklama: "Farklı sanat teknikleri ve malzemeleriyle çocukların kendilerini ifade etmelerini sağlayan görsel sanatlar etkinlikleri.",
        resim: "/art.webp",
        özellikler: ["Renk algısı", "Kompozisyon", "Sanatsal ifade", "El-göz koordinasyonu"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 4,
        başlık: "Bale ve Dans",
        açıklama: "Vücut koordinasyonu, ritim duygusu ve özgüven geliştiren, eğlenceli bale ve dans dersleri.",
        resim: "/dans.webp",
        özellikler: ["Ritim duygusu", "Denge ve koordinasyon", "Esneklik", "Sahne özgüveni"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 5,
        başlık: "Müzik ve Ritim",
        açıklama: "Çocukların müzikal zekalarını ve ritim duygularını geliştiren, çeşitli enstrümanlarla tanıştıkları müzik dersleri.",
        resim: "/muzik.webp",
        özellikler: ["Ses algısı", "Ritim yeteneği", "Müzikal ifade", "Dinleme becerisi"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 6,
        başlık: "Drama",
        açıklama: "Kendini ifade etme, empati ve sosyal beceriler kazandıran, yaratıcı drama etkinlikleri.",
        resim: "/drama.webp",
        özellikler: ["Empati", "Kendini ifade etme", "Rol yapma", "Sosyal beceriler"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 7,
        başlık: "Montessori Aktiviteleri",
        açıklama: "Montessori felsefesine uygun, çocukların bağımsız öğrenmelerini destekleyen, özel tasarlanmış materyallerle aktiviteler.",
        resim: "/montesori.webp",
        özellikler: ["Bağımsız öğrenme", "Pratik yaşam becerileri", "Düzen ve disiplin", "Odaklanma"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 8,
        başlık: "Satranç",
        açıklama: "Stratejik düşünme, planlama ve konsantrasyon becerilerini geliştiren, eğlenceli satranç dersleri.",
        resim: "/satranc.webp",
        özellikler: ["Stratejik düşünme", "Planlama", "Sabır", "Analitik zeka"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 9,
        başlık: "Beden Eğitimi",
        açıklama: "Çocukların fiziksel gelişimlerini destekleyen, temel motor becerileri geliştiren, eğlenceli spor etkinlikleri.",
        resim: "/beden.webp",
        özellikler: ["Temel motor beceriler", "Dayanıklılık", "Koordinasyon", "Takım ruhu"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 10,
        başlık: "Beceri Koordinasyon",
        açıklama: "İnce ve kaba motor becerileri geliştiren, el-göz koordinasyonunu güçlendiren özel tasarlanmış aktiviteler.",
        resim: "/motorskills.webp",
        özellikler: ["El-göz koordinasyonu", "Denge", "Hassas motor beceriler", "Vücut farkındalığı"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 11,
        başlık: "Psikolog ile Oyun Saati",
        açıklama: "Uzman psikolog eşliğinde, çocukların duygusal ve sosyal gelişimlerini destekleyen terapi oyunları.",
        resim: "/psikolog.webp",
        özellikler: ["Duygusal ifade", "Sosyal beceriler", "Problem çözme", "Özgüven geliştirme"],
        yaşGrubu: "3-6 yaş"
      }
    ],
    yaz: [
      {
        id: 12,
        başlık: "Yaz Okulu Aktiviteleri",
        açıklama: "Yaz boyunca çocukların eğlenerek öğrenmeye devam etmelerini sağlayan, zengin içerikli yaz okulu programı.",
        resim: "/yazaktiviteleri.webp",
        özellikler: ["Eğlenceli öğrenme", "Sosyal etkileşim", "Yaratıcı etkinlikler", "Açık hava aktiviteleri"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 13,
        başlık: "Binicilik",
        açıklama: "Çocukların atlarla bağ kurarak sorumluluk, güven ve denge becerilerini geliştirdiği binicilik dersleri.",
        resim: "/binincilik.webp",
        özellikler: ["Denge ve duruş", "Hayvan sevgisi", "Sorumluluk bilinci", "Özgüven"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 14,
        başlık: "Yüzme",
        açıklama: "Profesyonel eğitmenler eşliğinde, su korkusunu yenme ve temel yüzme becerilerini kazandıran yüzme dersleri.",
        resim: "/yuzme.webp",
        özellikler: ["Su güvenliği", "Temel yüzme teknikleri", "Nefes kontrolü", "Fiziksel dayanıklılık"],
        yaşGrubu: "3-6 yaş"
      },
      {
        id: 15,
        başlık: "Sportif Faaliyetler",
        açıklama: "Açık havada gerçekleştirilen, çocukların enerjilerini pozitif bir şekilde harcamalarını sağlayan çeşitli spor aktiviteleri.",
        resim: "/sportiffaaliyetler.webp",
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
      <div className="min-h-screen bg-orange-50">
        <Header />
        
        {/* Hero Section */}
        <div className="relative py-12 bg-indigo-900">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/90 to-purple-700/80"></div>
          
          {/* Dekoratif Şekiller */}
          <div className="absolute top-6 right-8 w-16 h-16 bg-yellow-400 rounded-full opacity-20"></div>
          <div className="absolute bottom-6 left-12 w-20 h-20 bg-red-500 rounded-full opacity-20"></div>
          
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Aktivitelerimiz
            </h1>
            <p className="text-white text-lg opacity-90 max-w-2xl mx-auto">
              Çocuklarımızın yeteneklerini keşfetmelerini sağlayan, gelişimlerini destekleyen eğlenceli ve eğitici aktivitelerimiz.
            </p>
          </div>
        </div>
        
        {/* Mevsim Seçim Bölümü */}
        <div className="py-8 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex items-center justify-center gap-4">
              <span className={`text-lg font-medium ${mevsim === "kış" ? "text-indigo-600" : "text-gray-400"}`}>Kış Dönemi</span>
              
              {/* Toggle Switch */}
              <button 
                onClick={mevsimDeğiştir} 
                className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  mevsim === "yaz" ? "bg-orange-500" : "bg-indigo-600"
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
              
              <span className={`text-lg font-medium ${mevsim === "yaz" ? "text-orange-500" : "text-gray-400"}`}>Yaz Dönemi</span>
            </div>
          </div>
        </div>
        
        {/* Aktivite Kartları Grid */}
        <div className="py-12 bg-orange-50">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-indigo-900 mb-12">
              {mevsim === "kış" ? "Kış Dönemi Aktivitelerimiz" : "Yaz Dönemi Aktivitelerimiz"}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {aktiviteler[mevsim].map((aktivite) => (
                <div 
                  key={aktivite.id} 
                  className={`bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer transition-transform duration-300 hover:shadow-lg hover:-translate-y-1 ${seçiliAktivite.id === aktivite.id ? "ring-2 ring-indigo-600" : ""}`}
                  onClick={() => aktiviteSeç(aktivite)}
                >
                  {/* Aktivite Resmi */}
                  <div className="relative h-48 bg-gray-200">
                    <Image
                      src={aktivite.resim || "/cocukklar.webp"}
                      alt={aktivite.başlık}
                      className="object-cover w-full h-full"
                      width={400}
                      height={300}
                    />
                    <div className="absolute top-3 right-3 bg-white rounded-full px-3 py-1 text-xs font-medium text-indigo-900">
                      {aktivite.yaşGrubu}
                    </div>
                  </div>
                  
                  {/* Aktivite Bilgileri */}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-indigo-900 mb-2">{aktivite.başlık}</h3>
                    <p className="text-gray-600 text-sm line-clamp-2">{aktivite.açıklama}</p>
                    
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-xs text-indigo-600 font-medium">{aktivite.özellikler.length} özellik</span>
                      <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-1">
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
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Aktivite Resmi */}
                <div className="relative h-80 md:h-auto bg-gray-200">
                  <Image
                    src={seçiliAktivite.resim || "/cocukklar.webp"}
                    alt={seçiliAktivite.başlık}
                    className="absolute inset-0 w-full h-full object-cover"
                    width={600}
                    height={600}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute bottom-4 left-4 bg-white rounded-lg px-3 py-1 text-sm font-medium text-indigo-900">
                    {seçiliAktivite.yaşGrubu}
                  </div>
                </div>
                
                {/* Aktivite Bilgileri */}
                <div className="p-6 md:p-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-indigo-900 mb-4">{seçiliAktivite.başlık}</h2>
                  <p className="text-gray-700 mb-6">{seçiliAktivite.açıklama}</p>
                  
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Kazanımlar</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {seçiliAktivite.özellikler.map((özellik, index) => (
                        <div key={index} className="flex items-center gap-2 bg-indigo-50 p-3 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className='text-black'>{özellik}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full transition-colors flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      Bilgi Al
                    </button>
                    <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full transition-colors flex items-center gap-2">
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
              <div className="bg-gradient-to-br from-green-600 to-teal-700 text-white rounded-2xl shadow-lg p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Aktivite Programını İndir</h3>
                  <p className="mb-4 opacity-90">Tüm aktivitelerimizin detaylı açıklamaları ve haftalık programını indirin.</p>
                  <button className="bg-white text-green-700 font-medium px-5 py-2 rounded-lg hover:bg-green-50 transition-colors">
                    PDF İndir
                  </button>
                </div>
              </div>
              
              {/* İletişim */}
              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-2xl shadow-lg p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Bizimle İletişime Geçin</h3>
                  <p className="mb-4 opacity-90">Sorularınız için bize ulaşın, en kısa sürede dönüş yapacağız.</p>
                  <button className="bg-white text-indigo-700 font-medium px-5 py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                    İletişim Formu
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* SSS Bölümü */}
        <div className="py-16 bg-orange-50">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-indigo-900 mb-4">
                Sıkça Sorulan Sorular
              </h2>
              <p className="text-gray-700 max-w-2xl mx-auto">
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
                <div key={index} className="bg-white rounded-xl shadow-md mb-4 overflow-hidden">
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-indigo-900 mb-2">{item.soru}</h3>
                    <p className="text-gray-700">{item.cevap}</p>
                  </div>
                </div>
              ))}
              
              <div className="text-center mt-8">
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full transition-colors inline-flex items-center gap-2">
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
        <div className="py-16 bg-indigo-900 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/90 to-purple-800/90"></div>
          
          {/* Dekoratif Şekiller */}
          <div className="absolute top-12 left-8 w-24 h-24 bg-yellow-400 rounded-full opacity-10"></div>
          <div className="absolute bottom-12 right-12 w-32 h-32 bg-red-500 rounded-full opacity-10"></div>
          
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Çocuğunuz İçin En İyi Başlangıç
            </h2>
            <p className="text-white text-lg opacity-90 max-w-2xl mx-auto mb-8">
              Kaliteli eğitim, uzman kadro ve modern tesislerimizle çocuğunuzun geleceğine yatırım yapın.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button className="bg-white text-indigo-900 hover:bg-indigo-50 px-8 py-3 rounded-full font-medium transition-colors">
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