import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/app/components/Header';
import { SITE, WHATSAPP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Talebiniz Alındı',
  robots: { index: false, follow: false },
};

export default function TesekkurlerPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl text-ink">Talebiniz bize ulaştı.</h1>
        <p className="mt-6 text-lg text-ink-soft">
          Okul yönetimimiz en geç <strong>15 dakika</strong> içinde sizi arayacak ve ön görüşme
          randevunuzu birlikte planlayacağız.
        </p>
        <p className="mt-4 text-ink-soft">
          Acele bir sorunuz varsa doğrudan ulaşabilirsiniz:
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <a href={`tel:${SITE.phone.e164}`} className="rounded-full bg-ink px-8 py-4 text-white">
            {SITE.phone.display}
          </a>
          <a href={WHATSAPP_URL} className="rounded-full border border-ink px-8 py-4 text-ink">
            WhatsApp&apos;tan Yazın
          </a>
        </div>
        <Link href="/" className="mt-10 inline-block text-ink-soft underline">
          Ana sayfaya dön
        </Link>
      </main>
    </div>
  );
}
