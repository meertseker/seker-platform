import { z } from 'zod';
import { normalizeTurkishPhone } from '@seker/shared';

/**
 * Ön görüşme formu yalnızca ad ve telefon ister. Yaş grubu, program,
 * başlangıç dönemi, e-posta ve serbest mesaj alanları kaldırıldı — bu
 * bilgiler formda değil, geri aramada konuşuluyor.
 *
 * gclid, landingPath ve utm gizli alanlardır (bkz. AttributionFields);
 * kullanıcı doldurmaz. Çok uzun gelirlerse reddedilmez, kırpılır: bir
 * reklam parametresi yüzünden başvuru kaybedilmemeli.
 *
 * website bir honeypot alanıdır: insan görmez, bot doldurur.
 */
export const PHONE_ERROR = 'Lütfen 05 ile başlayan cep telefonu numaranızı girin';

const MAX_HIDDEN = 200;
const hidden = z.string().trim().transform((v) => v.slice(0, MAX_HIDDEN));

export const leadSchema = z.object({
  parentName: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı').max(80),
  phone: z.string({ message: PHONE_ERROR }).transform((value, ctx) => {
    const normalized = normalizeTurkishPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: PHONE_ERROR });
      return z.NEVER;
    }
    return normalized;
  }),
  gclid: hidden.optional().default(''),
  landingPath: hidden.optional().default(''),
  utm: z
    .object({
      utm_source: hidden.optional(),
      utm_medium: hidden.optional(),
      utm_campaign: hidden.optional(),
      utm_term: hidden.optional(),
      utm_content: hidden.optional(),
    })
    .optional()
    .default({}),
  website: z.string().optional().default(''),
  kvkkConsent: z.literal(true, { message: 'Devam etmek için aydınlatma metnini onaylayın' }),
});

export type Lead = z.infer<typeof leadSchema>;
