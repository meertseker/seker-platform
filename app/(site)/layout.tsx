import '../cine.css';
import Footer from '../components/Footer';
import WhatsAppButton from '../components/WhatsAppButton';
import MobileActionBar from '../components/MobileActionBar';

export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <Footer />
      <WhatsAppButton />
      <MobileActionBar />
    </>
  );
}
