import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/app/components/Header';
import PageHero from '@/app/components/PageHero';
import { SITE, WHATSAPP_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Talebiniz Alındı',
  robots: { index: false, follow: false },
};

export default function TesekkurlerPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <PageHero
        eyebrow="Teşekkürler"
        title="Talebiniz bize ulaştı."
        lead="Okul yönetimimiz en geç 15 dakika içinde sizi arayacak ve ön görüşme randevunuzu birlikte planlayacağız."
        tone="mint"
      />
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-ink-soft">
          Acele bir sorunuz varsa doğrudan ulaşabilirsiniz:
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <a
            href={`tel:${SITE.phone.e164}`}
            className="rounded-full bg-grape px-8 py-4 font-semibold text-white shadow-lg shadow-grape/30 hover:bg-ink"
          >
            {SITE.phone.display}
          </a>
          <a
            href={WHATSAPP_URL}
            className="rounded-full border-2 border-mint-deep px-8 py-4 font-semibold text-ink hover:bg-mint/10"
          >
            WhatsApp&apos;tan Yazın
          </a>
        </div>
        <Link href="/" className="mt-10 inline-block font-semibold text-grape underline underline-offset-4">
          Ana sayfaya dön
        </Link>
      </main>
    </div>
  );
}
