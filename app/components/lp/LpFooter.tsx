import Link from 'next/link';
import { SITE } from '@/lib/site';

/** Minimal alt bar — site menüsüne link vermez. */
export default function LpFooter() {
  return (
    <footer className="border-t border-rule bg-paper py-10">
      <div className="mx-auto max-w-5xl px-6 text-sm text-ink-soft">
        <p className="font-medium text-ink">{SITE.name}</p>
        <p className="mt-2">
          {SITE.address.street}, {SITE.address.district}/{SITE.address.city}
        </p>
        <p className="mt-1">
          <a href={`tel:${SITE.phone.e164}`} className="hover:underline">{SITE.phone.display}</a>
          {' · '}
          <a href={`mailto:${SITE.email}`} className="hover:underline">{SITE.email}</a>
        </p>
        <p className="mt-4 text-xs">
          <Link href="/gizlilik" className="hover:underline">KVKK Aydınlatma Metni</Link>
          {' · '}
          <Link href="/cerez" className="hover:underline">Çerez Politikası</Link>
        </p>
      </div>
    </footer>
  );
}
