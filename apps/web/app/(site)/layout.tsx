import '../cine.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import WhatsAppButton from '../components/WhatsAppButton';
import MobileActionBar from '../components/MobileActionBar';
import { currentYear } from '@/lib/time';
import { getReaderData } from '@/lib/content/server';
import { pickData } from '@/lib/content/reader';
import EditLayerGate from '../components/edit/EditLayerGate';

export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const year = await currentYear();
  const data = await getReaderData();
  return (
    <>
      <Header data={pickData(data, ['chrome.nav.', 'chrome.header.', 'site.name'])} />
      {children}
      <Footer year={year} data={pickData(data, ['chrome.footer.', 'site.'])} />
      <WhatsAppButton data={pickData(data, ['chrome.whatsapp.', 'site.'])} />
      <MobileActionBar data={pickData(data, ['chrome.mobile.', 'site.'])} />
      <EditLayerGate />
    </>
  );
}
