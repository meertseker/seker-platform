'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AGE_GROUPS, PROGRAMS } from '@/lib/leadSchema';
import { trackEvent } from '@/lib/analytics';

const PROGRAM_LABELS: Record<(typeof PROGRAMS)[number], string> = {
  'tam-gun': 'Tam Gün',
  'yarim-gun': 'Yarım Gün',
  'yaz-okulu': 'Yaz Okulu',
};

type FieldErrors = Partial<Record<string, string[]>>;

export default function LeadForm({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
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
    const payload = {
      parentName: String(data.get('parentName') ?? ''),
      phone: String(data.get('phone') ?? ''),
      email: String(data.get('email') ?? ''),
      childAge: String(data.get('childAge') ?? ''),
      program: String(data.get('program') ?? ''),
      startTerm: String(data.get('startTerm') ?? ''),
      message: String(data.get('message') ?? ''),
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

      trackEvent('lead_submit', { child_age: payload.childAge });
      router.push('/tesekkurler');
    } catch {
      setFormError('Bağlantı hatası. Lütfen telefonla ulaşın.');
    } finally {
      setSubmitting(false);
    }
  }

  const field = 'w-full rounded-lg border border-navy-200 bg-white px-4 py-3 text-navy-900 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600';
  const label = 'mb-1.5 block text-sm font-medium text-navy-800';
  const err = (name: string) =>
    errors[name] ? <p className="mt-1 text-sm text-red-600">{errors[name]![0]}</p> : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="parentName" className={label}>Adınız Soyadınız *</label>
          <input id="parentName" name="parentName" className={field} required />
          {err('parentName')}
        </div>
        <div>
          <label htmlFor="phone" className={label}>Telefon *</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" placeholder="05XX XXX XX XX" className={field} required />
          {err('phone')}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="childAge" className={label}>Çocuğunuzun yaş grubu *</label>
          <select id="childAge" name="childAge" className={field} required defaultValue="">
            <option value="" disabled>Seçiniz</option>
            {AGE_GROUPS.map((age) => (
              <option key={age} value={age}>{age} yaş</option>
            ))}
          </select>
          {err('childAge')}
        </div>
        <div>
          <label htmlFor="program" className={label}>İlgilendiğiniz program *</label>
          <select id="program" name="program" className={field} required defaultValue="">
            <option value="" disabled>Seçiniz</option>
            {PROGRAMS.map((program) => (
              <option key={program} value={program}>{PROGRAM_LABELS[program]}</option>
            ))}
          </select>
          {err('program')}
        </div>
      </div>

      <div>
        <label htmlFor="startTerm" className={label}>Başlamayı düşündüğünüz dönem *</label>
        <select id="startTerm" name="startTerm" className={field} required defaultValue="">
          <option value="" disabled>Seçiniz</option>
          <option value="2026-2027">2026-2027 eğitim yılı</option>
          <option value="donem-ici">Dönem içi</option>
          <option value="yaz-2027">2027 yaz dönemi</option>
          <option value="arastiriyorum">Henüz araştırma aşamasındayım</option>
        </select>
        {err('startTerm')}
      </div>

      {variant === 'full' && (
        <div>
          <label htmlFor="email" className={label}>E-posta</label>
          <input id="email" name="email" type="email" className={field} />
          {err('email')}
        </div>
      )}

      {variant === 'full' && (
        <div>
          <label htmlFor="message" className={label}>Eklemek istedikleriniz</label>
          <textarea id="message" name="message" rows={4} className={field} />
        </div>
      )}

      <label className="flex items-start gap-3 text-sm text-navy-700">
        <input type="checkbox" name="kvkkConsent" required className="mt-1 h-4 w-4" />
        <span>
          <a href="/gizlilik" className="underline">KVKK Aydınlatma Metni</a>&apos;ni okudum, iletişim
          kurulmasına onay veriyorum. *
        </span>
      </label>
      {err('kvkkConsent')}

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-navy-900 px-8 py-4 font-medium text-white transition hover:bg-navy-800 disabled:opacity-60"
      >
        {submitting ? 'Gönderiliyor…' : 'Ön Görüşme Randevusu'}
      </button>

      <p className="text-center text-sm text-navy-600">
        Talebinize ortalama <strong>15 dakika</strong> içinde dönüş yapıyoruz.
      </p>
    </form>
  );
}
