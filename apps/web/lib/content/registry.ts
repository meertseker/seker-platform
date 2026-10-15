import type { SlotDef } from './types';
import { SITE_SLOTS } from './slots/site';
import { MEDIA_SLOTS } from './slots/media';
import { LIST_SLOTS } from './slots/lists';
import { HOME_SLOTS } from './slots/home';
import { CHROME_SLOTS } from './slots/chrome';
import { EGITIM_SLOTS } from './slots/egitim';
import { GUVENLIK_SLOTS } from './slots/guvenlik';

// Her sayfa görevi kendi slots dosyasını buraya ekler.
export const SLOTS: Record<string, SlotDef> = {
  ...SITE_SLOTS,
  ...MEDIA_SLOTS,
  ...LIST_SLOTS,
  ...HOME_SLOTS,
  ...CHROME_SLOTS,
  ...EGITIM_SLOTS,
  ...GUVENLIK_SLOTS,
};

export { PAGE_IDS } from './pageIds';
