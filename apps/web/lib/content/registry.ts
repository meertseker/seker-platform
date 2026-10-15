import type { SlotDef } from './types';
import { SITE_SLOTS } from './slots/site';

// Her sayfa görevi kendi slots dosyasını buraya ekler.
export const SLOTS: Record<string, SlotDef> = {
  ...SITE_SLOTS,
};

export { PAGE_IDS } from './pageIds';
