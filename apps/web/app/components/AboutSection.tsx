"use client"
import React from 'react'
import Image from 'next/image'

type Accent = 'mint' | 'bubble' | 'grape' | 'sunny'

const ACCENT_BLOB: Record<Accent, string> = {
  mint: 'bg-mint/50',
  bubble: 'bg-bubble/40',
  grape: 'bg-grape/35',
  sunny: 'bg-sunny/50',
}

interface AboutSectionProps {
  title: string
  description: string
  buttonText: string
  buttonLink: string
  imageSrc: string
  imageAlt: string
  imagePosition: 'left' | 'right'
  accent?: Accent
}

const AboutSection: React.FC<AboutSectionProps> = ({
  title,
  description,
  buttonText,
  buttonLink,
  imageSrc,
  imageAlt,
  imagePosition,
  accent = 'mint'
}) => {
  const isImageLeft = imagePosition === 'left'

  return (
    <div className="flex flex-col items-center gap-8 md:flex-row md:gap-16">
      {/* Image Area */}
      <div className={`relative order-2 hidden md:block md:w-1/2 md:${isImageLeft ? 'order-1' : 'order-2'}`}>
        {/* Decorative Background */}
        <div
          aria-hidden="true"
          className={`absolute -z-10 ${isImageLeft ? 'left-0' : 'right-0'} bottom-0 h-3/4 w-3/4 rounded-full ${ACCENT_BLOB[accent]}`}
        />

        {/* Decorative Elements — şeker konfetisi */}
        {!isImageLeft && (
          <div aria-hidden="true" className="absolute right-8 top-8 z-10 hidden flex-col gap-2 sm:flex">
            <div className="flex gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bubble">
                <div className="h-4 w-4 rounded-full bg-white" />
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-grape">
                <div className="mr-1 h-2 w-2 rounded-full bg-white" />
                <div className="ml-1 h-2 w-2 rounded-full bg-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-10 rounded-xl bg-sunny" />
              <div className="h-10 w-10 rotate-45 rounded-xl bg-sky" />
            </div>
          </div>
        )}

        {/* Child image */}
        <Image
          src={imageSrc}
          alt={imageAlt}
          className="relative z-0 h-auto w-full max-w-md rounded-3xl object-cover shadow-lg shadow-ink/10"
          width={400}
          height={400}
        />
      </div>

      {/* Text Content */}
      <div className={`order-1 md:w-1/2 md:${isImageLeft ? 'order-2' : 'order-1'}`}>
        <h2 className="mb-4 font-display text-2xl text-ink md:text-3xl">
          {title}
        </h2>
        <p className="mb-6 text-ink-soft">
          {description}
        </p>
        <a
          href={buttonLink}
          className="inline-block rounded-full bg-grape px-6 py-3 font-semibold text-white shadow-lg shadow-grape/30 transition-colors duration-200 hover:bg-ink"
        >
          {buttonText}
        </a>
      </div>
    </div>
  )
}

export default AboutSection 