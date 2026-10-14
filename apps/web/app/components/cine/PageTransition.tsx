'use client'

import { unstable_ViewTransition as ViewTransition } from 'react'

/**
 * Sayfa gövdesi — layout'taki header kalır, template her rotada yeniden
 * doğar. View Transition bu yeniden doğuşu kesme değil kesit gibi okutur.
 */
export default function PageTransition({
  children,
  name,
}: {
  children: React.ReactNode
  name?: string
}) {
  return <ViewTransition name={name}>{children}</ViewTransition>
}
