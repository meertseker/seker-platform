import '../cine.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import WhatsAppButton from '../components/WhatsAppButton';
import MobileActionBar from '../components/MobileActionBar';
import { currentYear } from '@/lib/time';

export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const year = await currentYear();
  return (
    <>
      <Header />
      {children}
      <Footer year={year} />
      <WhatsAppButton />
      <MobileActionBar />
    </>
  );
}
