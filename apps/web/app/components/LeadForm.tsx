'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackLead } from '@/lib/analytics';
import { UTM_KEYS } from '@/lib/attribution';
import AttributionFields from './AttributionFields';
import { KVKK_CONSENT_LABEL } from '@/content/kvkk';

type FieldErrors = Partial<Record<string, string[]>>;

/**
 * Geri arama formu — yalnızca ad ve telefon. Yaş grubu, program, başlangıç
 * dönemi, e-posta ve mesaj alanları kaldırıldı; bunlar aramada konuşuluyor.
 * Alan sayısı düştükçe form doldurma oranı yükselir.
 */
export default function LeadForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError('');

    const data = new FormData(event.currentTarget);
    const utm = Object.fromEntries(
      UTM_KEYS.map((key) => [key, String(data.get(key) ?? '')]).filter(([, value]) => value),
    );
    const payload = {
      parentName: String(data.get('parentName') ?? ''),
      phone: String(data.get('phone') ?? ''),
      gclid: String(data.get('gclid') ?? ''),
      landingPath: String(data.get('landingPath') ?? ''),
      utm,
      website: String(data.get('website') ?? ''),
      kvkkConsent: data.get('kvkkConsent') === 'on',
    };

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setErrors(result.errors ?? {});
        setFormError(result.message ?? 'Lütfen işaretli alanları kontrol edin.');
        return;
      }

      trackLead(undefined, { landing_path: payload.landingPath });
      router.push('/tesekkurler');
    } catch {
      setFormError('Bağlantı hatası. Lütfen telefonla ulaşın.');
    } finally {
      setSubmitting(false);
    }
  }

  const field =
    'w-full rounded-xl border-2 border-rule bg-white px-4 py-3 text-ink transition-colors focus:border-mark focus:outline-none focus:ring-1 focus:ring-mark';
  const label = 'mb-1.5 block text-sm font-semibold text-ink';
  const err = (name: string) =>
    errors[name] ? <p className="mt-1 text-sm text-red-600">{errors[name]![0]}</p> : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <AttributionFields />
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Web siteniz</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="parentName" className={label}>Adınız</label>
          <input id="parentName" name="parentName" autoComplete="name" className={field} required />
          {err('parentName')}
        </div>
        <div>
          <label htmlFor="phone" className={label}>Telefon numaranız</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="05XX XXX XX XX"
            className={field}
            required
          />
          {err('phone')}
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" name="kvkkConsent" required className="mt-1 h-4 w-4" />
        <span>
          <a href="/gizlilik" className="underline">KVKK Aydınlatma Metni</a>&apos;ni okudum.{' '}
          {KVKK_CONSENT_LABEL.slice("Aydınlatma Metni'ni okudum. ".length)}
        </span>
      </label>
      {err('kvkkConsent')}

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-grape px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-grape/30 transition hover:bg-ink disabled:opacity-60"
      >
        {submitting ? 'Gönderiliyor…' : 'Beni Arayın'}
      </button>

      <p className="text-center text-sm text-ink-soft">
        Numaranızı bırakın, <strong>15 dakika</strong> içinde sizi arayalım.
      </p>
    </form>
  );
}
