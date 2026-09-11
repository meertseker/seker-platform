"use client"
import React, { useState } from 'react'
import Link from 'next/link';
import Image from 'next/image';
import { SITE } from '@/lib/site';
import { NAV_ITEMS } from '@/content/nav';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <div className="relative z-9999">
      <header className="flex items-center justify-between border-b border-rule bg-white px-4 py-4 md:px-8">
        {/* Logo */}
        <Link href="/" aria-label={`${SITE.name} ana sayfa`} className="flex items-center font-bold text-lg md:text-xl text-ink">
          <div className="w-18 h-18">
            <Image src="/logo.png" alt={SITE.name} width={72} height={72} priority />
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm xl:text-base font-medium text-ink">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink transition-colors duration-200 hover:text-grape"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Contact Button - Desktop */}
        <Link
          href="/kayit"
          className="hidden shrink-0 rounded-full bg-grape px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-grape/25 transition-colors duration-200 hover:bg-ink lg:block"
        >
          Ön Görüşme Randevusu
        </Link>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMenu}
          className="p-2 text-ink focus:outline-none lg:hidden"
          aria-label="Toggle menu"
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

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="absolute left-0 right-0 top-full z-10 flex flex-col space-y-4 border-b border-rule bg-white px-6 py-4 font-medium text-ink shadow-lg shadow-ink/5 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink transition-colors duration-200 hover:text-grape"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/kayit"
            className="mt-2 rounded-full bg-grape py-2.5 text-center font-semibold text-white shadow-lg shadow-grape/25 transition-colors duration-200 hover:bg-ink"
          >
            Ön Görüşme Randevusu
          </Link>
        </div>
      )}
    </div>
  )
}

export default Header
