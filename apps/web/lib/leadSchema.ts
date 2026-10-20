import { z } from 'zod';
import { normalizeTurkishPhone } from '@seker/shared';
import { DISTRICTS } from '@/content/districts';

export const START_WINDOWS = ['hemen', '1_3_ay', '3_6_ay', 'gelecek_yil'] as const;

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
/** fbclid/fbc daha uzun olabilir; kırpılırsa Meta eşleşmesi bozulur (attribution.ts ve create_web_lead ile aynı sınır). */
const MAX_META_CLICK = 500;
const hidden = z.string().trim().transform((v) => v.slice(0, MAX_HIDDEN));
const metaClick = z.string().trim().transform((v) => v.slice(0, MAX_META_CLICK));

const base = z.object({
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
  // Meta (Instagram) tıklama/olay verisi: gizli alanlar, kırpılır; adCookieConsent çerez bandı seçimidir.
  fbclid: metaClick.optional().default(''),
  fbc: metaClick.optional().default(''),
  fbp: hidden.optional().default(''),
  metaEventId: hidden.optional().default(''),
  // Çerez seçimi hiçbir zaman başvuruyu reddettirmez: beklenmeyen değer onay yok sayılır.
  adCookieConsent: z.boolean().catch(false),
  // Formun gösterdiği onay metninin sürümü; eksik ya da geçersizse 1. Sunucu sürümüyle küçüğü kaydedilir.
  consentVersion: z.union([z.literal(1), z.literal(2)]).catch(1),
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
  // Nitelik soruları: yalnız reklam sayfası formunda (qualify) sorulur ve zorunludur.
  qualify: z.boolean().optional(),
  childBirthMonth: z.number().int().min(1).max(12).optional(),
  childBirthYear: z.number().int().optional(),
  district: z.enum(DISTRICTS).optional(),
  startWindow: z.enum(START_WINDOWS).optional(),
  wantsWhatsapp: z.boolean().optional(),
});

export const leadSchema = base.superRefine((lead, ctx) => {
  // qualify istemcinin gönderdiği bayraktır; atlatılırsa sonuç yalnız nitelik verisi olmayan bir lead olur.
  if (!lead.qualify) return;
  const need = (field: string, message: string) => ctx.addIssue({ code: 'custom', path: [field], message });
  if (lead.childBirthMonth === undefined) need('childBirthMonth', 'Doğum ayını seçin');
  const year = new Date().getFullYear();
  if (lead.childBirthYear === undefined || lead.childBirthYear < year - 7 || lead.childBirthYear > year) {
    need('childBirthYear', 'Doğum yılını seçin');
  }
  if (lead.district === undefined) need('district', 'Semtinizi seçin');
  if (lead.startWindow === undefined) need('startWindow', 'Başlangıç zamanını seçin');
  if (lead.wantsWhatsapp === undefined) need('wantsWhatsapp', 'Lütfen bir seçim yapın');
});

export type Lead = z.infer<typeof leadSchema>;
