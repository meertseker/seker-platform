import PageTransition from '@/app/components/cine/PageTransition'

export default function SiteTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <PageTransition>{children}</PageTransition>
}
