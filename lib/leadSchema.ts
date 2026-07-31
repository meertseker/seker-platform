import { z } from 'zod';

export const AGE_GROUPS = ['2-3', '3-4', '4-5', '5-6'] as const;
export const PROGRAMS = ['tam-gun', 'yarim-gun', 'oyun-grubu', 'yaz-okulu'] as const;

export const leadSchema = z.object({
  parentName: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı').max(80),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()\-+]/g, ''))
    .pipe(z.string().regex(/^\d{10,13}$/, 'Geçerli bir telefon numarası girin')),
  email: z.union([z.literal(''), z.string().email('Geçerli bir e-posta girin')]),
  childAge: z.enum(AGE_GROUPS, { message: 'Yaş grubu seçin' }),
  program: z.enum(PROGRAMS, { message: 'Program seçin' }),
  startTerm: z.string().trim().min(1, 'Başlangıç dönemi seçin').max(20),
  message: z.string().trim().max(1000).optional().default(''),
  gclid: z.string().trim().max(200).optional().default(''),
  landingPath: z.string().trim().max(200).optional().default(''),
  kvkkConsent: z.literal(true, { message: 'Devam etmek için aydınlatma metnini onaylayın' }),
});

export type Lead = z.infer<typeof leadSchema>;
