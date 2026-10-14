"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { SITE } from '@/lib/site'
import { NAV_ITEMS } from '@/content/nav'

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

const Header = () => {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  return (
    <div className="sticky top-0 z-50">
      <header className="flex items-center justify-between border-b border-rule bg-white/90 px-4 py-3 backdrop-blur-md md:px-8 md:py-4">
        <Link href="/" aria-label={`${SITE.name} ana sayfa`} className="flex items-center font-bold text-lg md:text-xl text-ink">
          <div className="h-14 w-14 md:h-18 md:w-18">
            <Image src="/logo.png" alt={SITE.name} width={72} height={72} priority />
          </div>
        </Link>

        <nav className="hidden items-center gap-6 font-medium text-ink lg:flex xl:gap-8 xl:text-base text-sm">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'text-grape'
                    : 'text-ink transition-colors duration-200 hover:text-grape'
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <Link
          href="/kayit"
          aria-current={pathname === '/kayit' ? 'page' : undefined}
          className="hidden shrink-0 rounded-full bg-grape px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-grape/25 transition-colors duration-200 hover:bg-ink lg:block"
        >
          Ön Görüşme Randevusu
        </Link>

        <button
          onClick={() => setIsMenuOpen((open) => !open)}
          className="p-2 text-ink lg:hidden"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
        >
          {isMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {isMenuOpen ? (
        <div className="absolute left-0 right-0 top-full z-10 flex flex-col space-y-4 border-b border-rule bg-white px-6 py-4 font-medium text-ink shadow-lg shadow-ink/5 lg:hidden">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={active ? 'text-grape' : 'text-ink hover:text-grape'}
              >
                {item.label}
              </Link>
            )
          })}
          <Link
            href="/kayit"
            className="mt-2 rounded-full bg-grape py-2.5 text-center font-semibold text-white shadow-lg shadow-grape/25 hover:bg-ink"
          >
            Ön Görüşme Randevusu
          </Link>
        </div>
      ) : null}
    </div>
  )
}

export default Header
