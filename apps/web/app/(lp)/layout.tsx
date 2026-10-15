import LpHeader from '../components/lp/LpHeader';
import LpFooter from '../components/lp/LpFooter';
import WhatsAppButton from '../components/WhatsAppButton';
import MobileActionBar from '../components/MobileActionBar';
import EditLayerGate from '../components/edit/EditLayerGate';

export default function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <LpHeader />
      {children}
      <LpFooter />
      <WhatsAppButton />
      <MobileActionBar />
      <EditLayerGate />
    </>
  );
}
