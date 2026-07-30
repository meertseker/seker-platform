"use client"
import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

// Define TypeScript types
type AktiviteType = {
  id: number;
  başlık: string;
  açıklama: string;
  resim: string;
  yaşGrubu: string;
};

const ActivitiesSection = () => {
  // Featured activities to show on homepage
  const featuredActivities: AktiviteType[] = [
    {
      id: 1,
      başlık: "Robotik Kodlama",
      açıklama: "Çocukların problem çözme ve mantıksal düşünme yeteneklerini geliştiren, eğlenceli robotik kodlama atölyeleri.",
      resim: "/robotic.webp",
      yaşGrubu: "3-6 yaş"
    },
    {
      id: 2,
      başlık: "Seramik",
      açıklama: "El becerilerini ve üç boyutlu düşünme yeteneğini geliştiren, çocukların kendi eserlerini yarattığı seramik atölyeleri.",
      resim: "/seramik.webp",
      yaşGrubu: "3-6 yaş"
    },
    {
      id: 3,
      başlık: "Bale ve Dans",
      açıklama: "Vücut koordinasyonu, ritim duygusu ve özgüven geliştiren, eğlenceli bale ve dans dersleri.",
      resim: "/dans.webp",
      yaşGrubu: "3-6 yaş"
    },
    {
      id: 4,
      başlık: "Müzik ve Ritim",
      açıklama: "Çocukların müzikal zekalarını ve ritim duygularını geliştiren, çeşitli enstrümanlarla tanıştıkları müzik dersleri.",
      resim: "/muzik.webp",
      yaşGrubu: "3-6 yaş"
    }
  ];

  return (
    <section className="py-16 bg-gradient-to-br from-orange-50 to-indigo-50">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-indigo-900 mb-4">
            Aktivitelerimiz
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Çocuklarımızın yeteneklerini keşfetmelerini sağlayan, gelişimlerini destekleyen 
            eğlenceli ve eğitici aktivitelerimizle tanışın.
          </p>
        </div>

        {/* Activities Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {featuredActivities.map((aktivite) => (
            <div 
              key={aktivite.id} 
              className="bg-white rounded-2xl shadow-lg overflow-hidden transition-transform duration-300 hover:shadow-xl hover:-translate-y-2"
            >
              {/* Activity Image */}
              <div className="relative h-48 bg-gray-200">
                <Image 
                  src={aktivite.resim || "/placeholder.jpg"} 
                  alt={aktivite.başlık}
                  className="object-cover w-full h-full"
                  width={300}
                  height={200}
                />
                <div className="absolute top-3 right-3 bg-indigo-600 text-white rounded-full px-3 py-1 text-xs font-medium">
                  {aktivite.yaşGrubu}
                </div>
              </div>
              
              {/* Activity Info */}
              <div className="p-5">
                <h3 className="text-lg font-bold text-indigo-900 mb-2 line-clamp-2">
                  {aktivite.başlık}
                </h3>
                <p className="text-gray-600 text-sm line-clamp-3">
                  {aktivite.açıklama}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Link 
            href="/aktiviteler"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            Tüm Aktivitelerimizi Keşfedin
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 right-10 w-20 h-20 bg-yellow-400 rounded-full opacity-10"></div>
        <div className="absolute bottom-20 left-10 w-16 h-16 bg-red-500 rounded-full opacity-10"></div>
      </div>
    </section>
  )
}

export default ActivitiesSection 