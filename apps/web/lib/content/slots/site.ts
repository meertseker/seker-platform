import { SITE } from '@/lib/site';
import { PROGRAM_HOURS } from '@/content/program';
import type { SlotDef } from '../types';

const HOUR = '^([01]\\d|2[0-3]):[0-5]\\d$';

export const SITE_SLOTS: Record<string, SlotDef> = {
  'site.name': { kind: 'text', max: 60, default: SITE.name, label: 'Okulun adı' },
  'site.description': { kind: 'text', max: 200, default: SITE.description, label: 'Kısa tanıtım (Google ve paylaşımlar)' },
  'site.phone': { kind: 'text', max: 20, default: SITE.phone.display, label: 'Telefon', pattern: '^0?5\\d{2} ?\\d{3} ?\\d{2} ?\\d{2}$' },
  'site.email': { kind: 'text', max: 80, default: SITE.email, label: 'E-posta', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
  'site.address.street': { kind: 'text', max: 100, default: SITE.address.street, label: 'Adres (sokak, no)' },
  'site.address.district': { kind: 'text', max: 60, default: SITE.address.district, label: 'Semt, ilçe' },
  'site.address.city': { kind: 'text', max: 40, default: SITE.address.city, label: 'Şehir' },
  'site.foundingYear': { kind: 'text', max: 4, default: String(SITE.foundingYear), label: 'Kuruluş yılı', pattern: '^(19|20)\\d{2}$' },
  'site.whatsappMessage': { kind: 'text', max: 200, default: SITE.whatsapp.defaultMessage, label: 'WhatsApp hazır mesajı' },
  'site.hours.full.opens': { kind: 'text', max: 5, default: PROGRAM_HOURS.full.opens, label: 'Tam gün açılış', pattern: HOUR },
  'site.hours.full.closes': { kind: 'text', max: 5, default: PROGRAM_HOURS.full.closes, label: 'Tam gün kapanış', pattern: HOUR },
  'site.hours.half.opens': { kind: 'text', max: 5, default: PROGRAM_HOURS.half.opens, label: 'Yarım gün başlangıç', pattern: HOUR },
  'site.hours.half.closes': { kind: 'text', max: 5, default: PROGRAM_HOURS.half.closes, label: 'Yarım gün bitiş', pattern: HOUR },
};
