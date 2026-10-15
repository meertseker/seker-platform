import type { SlotDef } from './types';
import { SITE_SLOTS } from './slots/site';

// Her sayfa görevi kendi slots dosyasını buraya ekler.
export const SLOTS: Record<string, SlotDef> = {
  ...SITE_SLOTS,
};

/** pathname → sayfa kimliği; `meta.<id>.title` / `meta.<id>.description` anahtarları için. */
export const PAGE_IDS: Record<string, string> = {};
