import LpHeader from '../components/lp/LpHeader';
import LpFooter from '../components/lp/LpFooter';
import WhatsAppButton from '../components/WhatsAppButton';
import MobileActionBar from '../components/MobileActionBar';
import EditLayerGate from '../components/edit/EditLayerGate';
import { getReaderData } from '@/lib/content/server';
import { pickData } from '@/lib/content/reader';

export default async function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const data = await getReaderData();
  return (
    <>
      <LpHeader data={pickData(data, ['site.'])} />
      {children}
      <LpFooter data={pickData(data, ['chrome.lp.footer.', 'site.'])} />
      <WhatsAppButton data={pickData(data, ['chrome.whatsapp.', 'site.'])} />
      <MobileActionBar data={pickData(data, ['chrome.mobile.', 'site.'])} bookHref="#form" />
      <EditLayerGate />
    </>
  );
}
