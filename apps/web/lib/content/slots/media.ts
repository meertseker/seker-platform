import { MEDIA } from '@/content/media';
import type { SlotDef } from '../types';

export const MEDIA_SLOTS: Record<string, SlotDef> = Object.fromEntries(
  Object.entries(MEDIA).map(([k, m]) => [
    `media.${k}`,
    {
      kind: 'image',
      label: m.alt.slice(0, 40),
      default: { src: m.src, alt: m.alt, width: m.width, height: m.height, assetId: null },
    } satisfies SlotDef,
  ]),
);
