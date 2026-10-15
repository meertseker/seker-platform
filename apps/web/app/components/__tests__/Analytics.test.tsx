import { describe, it, expect, vi, beforeEach } from 'vitest';

let editing = false;
vi.mock('@/lib/content/getContent', () => ({ isEditing: async () => editing }));
vi.mock('next/script', () => ({ default: () => null }));

import Analytics from '../Analytics';

describe('Analytics', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_GTM_ID = 'GTM-TEST';
  });

  it('ziyaretçiye GTM betiğini verir', async () => {
    editing = false;
    expect(await Analytics()).not.toBeNull();
  });

  it('düzenleme (draft) modunda hiçbir şey çizmez', async () => {
    editing = true;
    expect(await Analytics()).toBeNull();
  });
});
