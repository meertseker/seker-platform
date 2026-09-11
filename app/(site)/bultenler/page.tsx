"use client";
import React, { useState } from 'react';
import Header from '@/app/components/Header';
import Image from 'next/image';

const Bultenler = () => {
  // Active tab state
  const [activeTab, setActiveTab] = useState("pdfler");
  
  // Dummy data for announcements
  const [duyurular] = useState([
    {
      id: 1,
      baslik: "Yaz Okulu Kayıtları Başladı",
      tarih: "01.05.2025",
      icerik: "2025 yaz okulu kayıtlarımız başlamıştır. Kontenjanlarımız sınırlı olduğundan, kayıt yaptırmak için acele ediniz.",
      onemli: true
    },
    {
      id: 2,
      baslik: "23 Nisan Etkinliği",
      tarih: "15.04.2025",
      icerik: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı kapsamında okulumuzda düzenlenecek etkinliklere tüm velilerimiz davetlidir.",
      onemli: true
    }
  ]);

  // PDF documents
  const pdfDokumanlari = [
    {
      id: 1,
      baslik: "Aylık Bültenler",
      aciklama: "Her ayın etkinlik programı ve gelişim raporları",
      renk: "from-grape to-ink",
      butonRenk: "bg-grape hover:bg-ink",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      id: 2,
      baslik: "Günlük Programlar",
      aciklama: "Günlük aktivite planları ve beslenme programı",
      renk: "from-mint to-grape",
      butonRenk: "bg-mint-deep hover:bg-ink",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      id: 3,
      baslik: "İngilizce Programları",
      aciklama: "İngilizce dil gelişimi ve aktivite programları",
      renk: "from-sky to-grape",
      butonRenk: "bg-sky-deep hover:bg-ink",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      id: 4,
      baslik: "Psikolog Bülteni",
      aciklama: "Aylık gelişim değerlendirme raporları",
      renk: "from-bubble to-grape",
      butonRenk: "bg-bubble-deep hover:bg-ink",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      id: 5,
      baslik: "Yemek Listeleri",
      aciklama: "Aylık yemek listeleri ve beslenme programı",
      renk: "from-sunny to-tangerine",
      butonRenk: "bg-tangerine-deep hover:bg-ink",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )
    }
  ];

  // Dummy data for trips
  const gezilerimiz = [
    {
      id: 1,
      baslik: "Doğa Müzesi Gezisi",
      tarih: "15.04.2025",
      resim: "/yazaktiviteleri.webp",
      aciklama: "Öğrencilerimiz ile beraber doğa müzesine yaptığımız eğitici gezi"
    },
    {
      id: 2,
      baslik: "Çiftlik Gezisi",
      tarih: "20.03.2025",
      resim: "/sportiffaaliyetler.webp",
      aciklama: "Hayvanları yakından tanıma fırsatı bulduk"
    },
    {
      id: 3,
      baslik: "Bilim Merkezi",
      tarih: "10.02.2025",
      resim: "/binincilik.webp",
      aciklama: "Deneylerle dolu bir gün geçirdik"
    },
    {
      id: 4,
      baslik: "Şehir Tiyatrosu",
      tarih: "05.01.2025",
      resim: "/yuzme.webp",
      aciklama: "Çocuk oyununu hep beraber izledik"
    }
  ];

  // Dummy data for activities
  const aktivitelerimiz = [
    {
      id: 1,
      baslik: "23 Nisan Kutlamaları",
      tarih: "23.04.2025",
      resim: "/seramik.webp",
      aciklama: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı etkinliklerimiz"
    },
    {
      id: 2,
      baslik: "Kış Partisi",
      tarih: "15.02.2025",
      resim: "/robotic.webp",
      aciklama: "Eğlenceli kış partimizden kareler"
    },
    {
      id: 3,
      baslik: "Resim Atölyesi",
      tarih: "10.03.2025",
      resim: "/muzik.webp",
      aciklama: "Minik sanatçılarımızın eserleri"
    },
    {
      id: 4,
      baslik: "Yıl Sonu Gösterisi",
      tarih: "20.06.2024",
      resim: "/seramik.webp",
      aciklama: "Geçen yılki yıl sonu gösterimizden anlar"
    },
    {
      id: 5,
      baslik: "Okuma Etkinliği",
      tarih: "08.03.2025",
      resim: "/robotic.webp",
      aciklama: "Dünya Kitap Günü etkinliklerimiz"
    },
    {
      id: 6,
      baslik: "Müzik Dersi",
      tarih: "12.04.2025",
      resim: "/muzik.webp",
      aciklama: "Ritim ve müzik dersimizden keyifli anlar"
    }
  ];

  // Haftalık yemek listesi
  const yemekListesi = [
    {
      gun: "Pazartesi",
      sabah: "Peynirli Omlet, Zeytin, Domates",
      ogle: "Mercimek Çorbası, Tavuk Sote, Pilav, Salata",
      ikindi: "Meyve Salatası, Kraker"
    },
    {
      gun: "Salı",
      sabah: "Bal, Kaymak, Ekmek, Süt",
      ogle: "Sebze Çorbası, Kıymalı Makarna, Yoğurt",
      ikindi: "Kek, Süt"
    },
    {
      gun: "Çarşamba",
      sabah: "Kaşarlı Tost, Domates, Salatalık",
      ogle: "Tarhana Çorbası, Fırın Köfte, Bulgur Pilavı, Cacık",
      ikindi: "Mevsim Meyveleri"
    },
    {
      gun: "Perşembe",
      sabah: "Yumurta, Peynir, Zeytin, Ekmek",
      ogle: "Ezogelin Çorbası, Etli Nohut, Pilav, Ayran",
      ikindi: "Kurabiye, Meyve Suyu"
    },
    {
      gun: "Cuma",
      sabah: "Reçel, Tereyağı, Ekmek, Süt",
      ogle: "Domates Çorbası, Balık, Patates Salatası",
      ikindi: "Sütlaç"
    }
  ];

  // Tab content rendering function
  const renderTabContent = () => {
    switch (activeTab) {
      case "pdfler":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {pdfDokumanlari.map((pdf) => (
              <div key={pdf.id} className="bg-white rounded-3xl shadow-sm overflow-hidden">
                <div className={`p-5 bg-gradient-to-r ${pdf.renk} text-white`}>
                  <h3 className="text-xl font-bold mb-2">{pdf.baslik}</h3>
                  <p className="text-sm opacity-90">{pdf.aciklama}</p>
                </div>
                <div className="p-5">
                  <button className={`w-full ${pdf.butonRenk} text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2`}>
                    {pdf.icon}
                    PDF İndir
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      case "duyurular":
        return (
          <div className="space-y-4">
            {duyurular.map((duyuru) => (
              <div 
                key={duyuru.id} 
                className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 ${duyuru.onemli ? 'border-bubble' : 'border-grape'}`}
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-ink flex items-center">
                      {duyuru.onemli && (
                        <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-bubble/15 text-bubble-deep">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      {duyuru.baslik}
                    </h3>
                    <span className="text-sm text-ink-soft">{duyuru.tarih}</span>
                  </div>
                  <p className="text-ink-soft">{duyuru.icerik}</p>
                </div>
              </div>
            ))}
          </div>
        );
      case "yemeklistesi":
        return (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-sunny to-tangerine text-white">
              <h3 className="text-xl font-bold mb-2">Haftalık Yemek Listesi</h3>
              <p className="text-sm opacity-90">01.05.2025 - 05.05.2025</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-rule">
                <thead className="bg-paper-warm">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-soft uppercase tracking-wider">Gün</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-soft uppercase tracking-wider">Sabah Kahvaltısı</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-soft uppercase tracking-wider">Öğle Yemeği</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-ink-soft uppercase tracking-wider">İkindi Kahvaltısı</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-rule">
                  {yemekListesi.map((yemek, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-paper-warm'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ink">{yemek.gun}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-soft">{yemek.sabah}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-soft">{yemek.ogle}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-soft">{yemek.ikindi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex justify-center">
              <button className="bg-tangerine-deep hover:bg-ink text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Aylık Yemek Listesi PDF
              </button>
            </div>
          </div>
        );
      case "gezilerimiz":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {gezilerimiz.map((gezi) => (
              <div key={gezi.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="aspect-w-16 aspect-h-9 relative h-60">
                  <Image
                    src={gezi.resim || "/cocukklar.webp"}
                    alt={gezi.baslik}
                    className="object-cover"
                    fill
                  />
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-ink">{gezi.baslik}</h3>
                    <span className="text-sm text-ink-soft">{gezi.tarih}</span>
                  </div>
                  <p className="text-ink-soft">{gezi.aciklama}</p>
                </div>
              </div>
            ))}
          </div>
        );
      case "aktiviteler":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {aktivitelerimiz.map((aktivite) => (
              <div key={aktivite.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="aspect-w-16 aspect-h-9 relative h-52">
                  <Image
                    src={aktivite.resim || "/cocukklar.webp"}
                    alt={aktivite.baslik}
                    className="object-cover"
                    fill
                  />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold text-ink">{aktivite.baslik}</h3>
                    <span className="text-sm text-ink-soft">{aktivite.tarih}</span>
                  </div>
                  <p className="text-ink-soft text-sm">{aktivite.aciklama}</p>
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-paper-warm">
      <Header />
      
      {/* Hero Section */}
      <div className="band-sky relative overflow-hidden py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0"></div>
        
        <span aria-hidden="true" className="confetti-float absolute right-8 top-6 h-16 w-16 rounded-full bg-sunny/25"></span>
        <span aria-hidden="true" className="confetti-float absolute bottom-6 left-12 h-20 w-20 rounded-full bg-bubble/20"></span>
        
        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Bültenler ve Dokümanlar
          </h1>
          <p className="text-white text-lg opacity-90 max-w-2xl mx-auto">
            Kurumumuzdaki tüm güncel dokümanlar, duyurular ve etkinlik görsellerine buradan ulaşabilirsiniz.
          </p>
        </div>
        <div aria-hidden="true" className="scallop scallop-white absolute inset-x-0 bottom-0" />
      </div>
      
      {/* Navigation Tabs */}
      <div className="bg-white shadow-md">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex overflow-x-auto scrollbar-hide py-2">
            {[
              { id: "pdfler", label: "PDF Dokümanlar", icon: "document-text" },
              { id: "duyurular", label: "Duyurular", icon: "speakerphone" },
              { id: "yemeklistesi", label: "Yemek Listesi", icon: "cake" },
              { id: "gezilerimiz", label: "Gezilerimiz", icon: "photograph" },
              { id: "aktiviteler", label: "Aktivitelerimiz", icon: "academic-cap" }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`flex items-center px-4 py-2 mr-4 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-grape text-white"
                    : "text-ink-soft hover:bg-paper-warm"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Content Section */}
      <div className="py-12 bg-paper-warm">
        <div className="container mx-auto px-4 md:px-6">
          {renderTabContent()}
        </div>
      </div>
      
      {/* Call to Action */}
      <div className="band-grape relative overflow-hidden py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0"></div>
        
        <span aria-hidden="true" className="confetti-float absolute left-8 top-12 h-24 w-24 rounded-full bg-sunny/20"></span>
        <span aria-hidden="true" className="confetti-float absolute bottom-12 right-12 h-32 w-32 rounded-full bg-bubble/20"></span>
        
        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Güncel Bültenlerimizden Haberdar Olun
          </h2>
          <p className="text-white text-lg opacity-90 max-w-2xl mx-auto mb-8">
            Mail listemize kaydolarak tüm güncel bültenlerimiz ve etkinliklerimizden anında haberdar olabilirsiniz.
          </p>
          <div className="max-w-md mx-auto">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="E-posta adresinizi giriniz"
                className="flex-1 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-grape"
              />
              <button className="bg-white text-ink hover:bg-paper-warm px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap">
                Kaydol
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bultenler;