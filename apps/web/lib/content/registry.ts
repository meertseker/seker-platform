import type { SlotDef } from './types';
import { SITE_SLOTS } from './slots/site';
import { MEDIA_SLOTS } from './slots/media';
import { LIST_SLOTS } from './slots/lists';
import { HOME_SLOTS } from './slots/home';
import { CHROME_SLOTS } from './slots/chrome';
import { HAKKIMIZDA_SLOTS } from './slots/hakkimizda';
import { EGITIM_SLOTS } from './slots/egitim';
import { GUVENLIK_SLOTS } from './slots/guvenlik';
import { YASGRUPLARI_SLOTS } from './slots/yasgruplari';
import { GUNLUKAKIS_SLOTS } from './slots/gunlukakis';
import { AKTIVITELER_SLOTS } from './slots/aktiviteler';
import { FORM_SLOTS } from './slots/form';
import { KAYIT_SLOTS } from './slots/kayit';
import { ILETISIM_SLOTS } from './slots/iletisim';
import { TESEKKURLER_SLOTS } from './slots/tesekkurler';

// Her sayfa görevi kendi slots dosyasını buraya ekler.
export const SLOTS: Record<string, SlotDef> = {
  ...SITE_SLOTS,
  ...MEDIA_SLOTS,
  ...LIST_SLOTS,
  ...HOME_SLOTS,
  ...CHROME_SLOTS,
  ...HAKKIMIZDA_SLOTS,
  ...EGITIM_SLOTS,
  ...GUVENLIK_SLOTS,
  ...YASGRUPLARI_SLOTS,
  ...GUNLUKAKIS_SLOTS,
  ...AKTIVITELER_SLOTS,
  ...FORM_SLOTS,
  ...KAYIT_SLOTS,
  ...ILETISIM_SLOTS,
  ...TESEKKURLER_SLOTS,
};

export { PAGE_IDS } from './pageIds';
