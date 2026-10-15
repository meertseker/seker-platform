import { vi } from 'vitest';

// Testlerde önbellek API'leri etkisiz; tek tek test dosyaları kendi vi.mock'larıyla bunu ezebilir.
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), updateTag: vi.fn(), revalidatePath: vi.fn() }));
