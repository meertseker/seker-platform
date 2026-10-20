'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trackLead } from '@/lib/analytics';
import { UTM_KEYS } from '@/lib/attribution';
import { trackMetaLead } from '@/lib/metaPixel';
import { newEventId } from '@/lib/metaClick';
import { readConsent } from '@/lib/consent';
import AttributionFields from './AttributionFields';
import { KVKK_CONSENT_LABEL } from '@/content/kvkk';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';
import { FORM_DEFAULTS } from '@/lib/content/slots/form';
import { DISTRICTS } from '@/content/districts';
import { START_WINDOWS } from '@/lib/leadSchema';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

type FieldErrors = Partial<Record<string, string[]>>;

/**
 * Geri arama formu — yalnızca ad ve telefon. Yaş grubu, program, başlangıç
 * dönemi, e-posta ve mesaj alanları kaldırıldı; bunlar aramada konuşuluyor.
 * Alan sayısı düştükçe form doldurma oranı yükselir.
 */
export default function LeadForm({
  data,
  qualify = false,
  currentYear,
}: { data?: ReaderData; qualify?: boolean; currentYear?: number } = {}) {
  // Yıl aralığı sunucudan prop olarak gelebilir (hidrasyon uyumu); verilmezse istemci yılı.
  const thisYear = currentYear ?? new Date().getFullYear();
  const router = useRouter();
  // Etiketler `form.*` slot'larından gelir; data verilmeyen sayfalarda (veya anahtar yoksa) koddaki varsayılan kullanılır.
  const reader = data ? makeReader(data) : null;
  const t = (key: string): string => (reader && data && key in data.values ? reader.text(key) : FORM_DEFAULTS[key]);
  const attrs = (key: string): Record<string, string> => (reader && data && key in data.meta ? reader.attrs(key) : {});
  // Sabit seçenek metinleri (ay, yıl, semt) içerik alanı değildir; yalnız düzenleme modunda işaretlenir.
  const ign: Record<string, string> = reader?.editing ? { 'data-edit-ignore': '' } : {};
  // Tarayıcı pikseli ile sunucu olayının eşleşmesi için form açılışında bir kez üretilir.
  const [metaEventId] = useState(newEventId);
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
    // Çerez onayı gönderim anında okunur; depolama hata verirse başvuru yine gider (onay yok sayılır).
    let adCookieConsent = false;
    try {
      adCookieConsent = readConsent(window.localStorage) === 'granted';
    } catch {
      adCookieConsent = false;
    }
    const payload = {
      parentName: String(data.get('parentName') ?? ''),
      phone: String(data.get('phone') ?? ''),
      gclid: String(data.get('gclid') ?? ''),
      landingPath: String(data.get('landingPath') ?? ''),
      fbclid: String(data.get('fbclid') ?? ''),
      fbc: String(data.get('fbc') ?? ''),
      fbp: String(data.get('fbp') ?? ''),
      metaEventId,
      adCookieConsent,
      utm,
      website: String(data.get('website') ?? ''),
      kvkkConsent: data.get('kvkkConsent') === 'on',
      ...(qualify
        ? {
            qualify: true,
            childBirthMonth: data.get('childBirthMonth') ? Number(data.get('childBirthMonth')) : undefined,
            childBirthYear: data.get('childBirthYear') ? Number(data.get('childBirthYear')) : undefined,
            district: data.get('district') ? String(data.get('district')) : undefined,
            startWindow: data.get('startWindow') ? String(data.get('startWindow')) : undefined,
            wantsWhatsapp: data.get('wantsWhatsapp') === 'on',
          }
        : {}),
    };

    // Form noValidate olduğundan (ana sayfa davranışı korunur) qualify alanlarının eksiği istemcide yakalanır; sunucuya 400 gitmez.
    if (qualify) {
      const missing: FieldErrors = {};
      if (!payload.childBirthMonth) missing.childBirthMonth = ['Doğum ayını seçin'];
      if (!payload.childBirthYear) missing.childBirthYear = ['Doğum yılını seçin'];
      if (!payload.district) missing.district = ['Semtinizi seçin'];
      if (!payload.startWindow) missing.startWindow = ['Başlangıç zamanını seçin'];
      if (Object.keys(missing).length) {
        setErrors(missing);
        setFormError(t('form.invalid'));
        setSubmitting(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setErrors(result.errors ?? {});
        setFormError(result.message ?? t('form.invalid'));
        return;
      }

      trackLead(undefined, { landing_path: payload.landingPath });
      trackMetaLead(metaEventId);
      router.push('/tesekkurler');
    } catch {
      setFormError(t('form.error'));
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
          <label htmlFor="parentName" className={label} {...attrs('form.parentName.label')}>{t('form.parentName.label')}</label>
          <input id="parentName" name="parentName" autoComplete="name" className={field} required />
          {err('parentName')}
        </div>
        <div>
          <label htmlFor="phone" className={label} {...attrs('form.phone.label')}>{t('form.phone.label')}</label>
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

      {qualify && (
        <>
          <fieldset>
            <legend className={label} {...attrs('form.birth.legend')}>{t('form.birth.legend')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="childBirthMonth" className="sr-only" {...ign}>Doğum ayı</label>
                <select id="childBirthMonth" name="childBirthMonth" defaultValue="" required className={`${field} min-h-[44px]`} {...ign}>
                  <option value="">Ay</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
                {err('childBirthMonth')}
              </div>
              <div>
                <label htmlFor="childBirthYear" className="sr-only" {...ign}>Doğum yılı</label>
                <select id="childBirthYear" name="childBirthYear" defaultValue="" required className={`${field} min-h-[44px]`} {...ign}>
                  <option value="">Yıl</option>
                  {Array.from({ length: 8 }, (_, i) => thisYear - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {err('childBirthYear')}
              </div>
            </div>
          </fieldset>

          <div>
            <label htmlFor="district" className={label} {...attrs('form.district.label')}>{t('form.district.label')}</label>
            <select id="district" name="district" defaultValue="" required className={`${field} min-h-[44px]`} {...ign}>
              <option value="">Seçin</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {err('district')}
          </div>

          <fieldset>
            <legend className={label} {...attrs('form.start.legend')}>{t('form.start.legend')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {START_WINDOWS.map((w) => (
                <label key={w} className="flex min-h-[44px] items-center gap-3 rounded-xl border-2 border-rule bg-white px-4 py-2 text-ink">
                  <input type="radio" name="startWindow" value={w} required className="h-5 w-5" />
                  <span {...attrs(`form.start.${w}`)}>{t(`form.start.${w}`)}</span>
                </label>
              ))}
            </div>
            {err('startWindow')}
          </fieldset>

          <label className="flex min-h-[44px] items-center gap-3 text-ink">
            <input type="checkbox" name="wantsWhatsapp" className="h-5 w-5" />
            <span {...attrs('form.whatsapp.label')}>{t('form.whatsapp.label')}</span>
          </label>
        </>
      )}

      {/* KVKK onay cümlesi hukuki metindir: düzenlenemez, kodda kalır. data-edit-ignore yalnızca düzenleme modunda basılır (ziyaretçi HTML'i değişmesin). */}
      <label {...(reader?.editing ? { 'data-edit-ignore': '' } : {})} className="flex items-start gap-3 text-sm text-ink-soft">
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
        {...attrs('form.submit')}
      >
        {submitting ? t('form.submitting') : t('form.submit')}
      </button>

      <p className="text-center text-sm text-ink-soft">
        {t('form.help.before')} <strong {...attrs('form.help.emphasis')}>{t('form.help.emphasis')}</strong> {t('form.help.after')}
      </p>
    </form>
  );
}
