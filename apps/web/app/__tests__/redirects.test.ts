import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';

describe('kaldırılan sayfaların kalıcı yönlendirmeleri', () => {
  it.each([
    ['/bultenler', '/'],
    ['/guvenlik', '/hakkimizda#guvenlik'],
  ])('%s → %s (kalıcı)', async (source, destination) => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toContainEqual(expect.objectContaining({ source, destination, permanent: true }));
  });
});
