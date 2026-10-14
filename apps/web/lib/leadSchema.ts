import { z } from 'zod';

/**
 * Ön görüşme formu yalnızca ad ve telefon ister. Yaş grubu, program,
 * başlangıç dönemi, e-posta ve serbest mesaj alanları kaldırıldı — bu
 * bilgiler formda değil, geri aramada konuşuluyor. Alan sayısı düştükçe
 * form doldurma oranı yükselir; bu bilinçli bir dönüşüm tercihidir.
 *
 * Yaş grubu artık gelmediği için lead değeri yaşa göre ayrışamaz —
 * bkz. lib/analytics.ts'teki trackLead notu.
 *
 * gclid ve landingPath gizli alanlardır (bkz. AttributionFields);
 * kullanıcı doldurmaz, offline conversion import için taşınır.
 */
export const leadSchema = z.object({
  parentName: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı').max(80),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()\-+]/g, ''))
    .pipe(z.string().regex(/^\d{10,13}$/, 'Geçerli bir telefon numarası girin')),
  gclid: z.string().trim().max(200).optional().default(''),
  landingPath: z.string().trim().max(200).optional().default(''),
  kvkkConsent: z.literal(true, { message: 'Devam etmek için aydınlatma metnini onaylayın' }),
});

export type Lead = z.infer<typeof leadSchema>;
