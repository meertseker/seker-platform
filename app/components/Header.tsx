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
      <header className="bg-white px-4 md:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" aria-label={`${SITE.name} ana sayfa`} className="flex items-center font-bold text-lg md:text-xl text-ink">
          <div className="w-18 h-18">
            <Image src="/logo.png" alt={SITE.name} width={72} height={72} priority />
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6 lg:space-x-8 text-sm lg:text-base font-medium text-ink">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink transition-colors duration-200 hover:opacity-70"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Contact Button - Desktop */}
        <Link
          href="/kayit"
          className="hidden md:block rounded-full bg-mark px-5 py-2 text-sm font-medium text-ink shadow-sm transition-opacity duration-200 hover:opacity-90"
        >
          Ön Görüşme Randevusu
        </Link>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMenu}
          className="md:hidden text-ink p-2 focus:outline-none"
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
        <div className="md:hidden absolute top-full left-0 right-0 bg-white shadow-md z-10 py-4 px-6 flex flex-col space-y-4 font-medium text-ink">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink transition-colors duration-200 hover:opacity-70"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/kayit"
            className="rounded-full bg-mark py-2 text-center font-medium text-ink shadow-sm transition-opacity duration-200 hover:opacity-90 mt-2"
          >
            Ön Görüşme Randevusu
          </Link>
        </div>
      )}
    </div>
  )
}

export default Header
