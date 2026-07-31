import Link from 'next/link'
import Image from 'next/image'
import SocialMediaLinks from './SocialMediaLinks'
import { FOOTER_LINKS } from '@/content/nav'
import { SITE } from '@/lib/site'

const Footer = () => {
  return (
    <footer className="bg-ink text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div>
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 relative mr-3">
                <Image
                  src="/logo.png"
                  alt={SITE.name}
                  fill
                  className="object-contain"
                />
              </div>
              <h3 className="text-2xl font-bold text-paper">
                Şeker Anaokulu
              </h3>
            </div>
            <p className="text-paper mb-6 leading-relaxed">
              Çocukların mutlu ve güvenli bir ortamda büyüdüğü, öğrendiği ve geliştiği eğitim kurumumuz.
            </p>

            {/* Social Media Links */}
            <SocialMediaLinks />
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-paper">Hızlı Linkler</h4>
            <ul className="space-y-2">
              {FOOTER_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-paper hover:text-white transition-colors duration-200">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4 text-paper">İletişim</h4>
            <div className="space-y-3">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-paper/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-paper text-sm leading-relaxed">
                  {SITE.address.street}
                  <br />
                  {SITE.address.district}/{SITE.address.city}
                </span>
              </div>

              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3 text-paper/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href={`tel:${SITE.phone.e164}`} className="text-paper hover:text-white text-sm transition-colors duration-200">
                  {SITE.phone.display}
                </a>
              </div>

              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3 text-paper/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href={`mailto:${SITE.email}`} className="text-paper hover:text-white text-sm transition-colors duration-200">
                  {SITE.email}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-paper/10 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-paper/70 text-sm mb-4 md:mb-0">
              © {new Date().getFullYear()} Şeker Anaokulu. Tüm hakları saklıdır.
            </div>
            <div className="flex space-x-6 text-sm">
              <Link href="/gizlilik" className="text-paper/70 hover:text-white transition-colors duration-200">
                Gizlilik Politikası
              </Link>
              <Link href="/kullanim" className="text-paper/70 hover:text-white transition-colors duration-200">
                Kullanım Şartları
              </Link>
              <Link href="/cerez" className="text-paper/70 hover:text-white transition-colors duration-200">
                Çerez Politikası
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
