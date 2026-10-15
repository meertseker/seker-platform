import { describe, it, expect } from 'vitest';
import { sanitizeRich, richToText } from '../sanitize';

describe('sanitizeRich', () => {
  it('izinsiz etiketleri ve betikleri temizler', () => {
    expect(sanitizeRich('<p>a</p><script>x()</script><img src=x onerror=y>')).toBe('<p>a</p>');
  });
  it('izinsiz şemalı bağlantıyı düşürür, izinliye rel/target ekler', () => {
    expect(sanitizeRich('<a href="javascript:alert(1)">t</a>')).toBe('<a>t</a>');
    expect(sanitizeRich('<a href="https://x.com">t</a>')).toBe(
      '<a href="https://x.com" rel="noopener noreferrer" target="_blank">t</a>',
    );
  });
  it('normal anahtarda h2 silinir', () => {
    expect(sanitizeRich('<h2>Başlık</h2><p>metin</p>')).toBe('Başlık<p>metin</p>');
  });
  it('legal.* tarzı anahtarda (allowHeadings) h2 korunur', () => {
    expect(sanitizeRich('<h2>Başlık</h2><p>metin</p>', { allowHeadings: true })).toBe('<h2>Başlık</h2><p>metin</p>');
    expect(sanitizeRich('<h3>x</h3><script>y</script>', { allowHeadings: true })).toBe('x');
  });
  it('richToText etiketleri atar', () => {
    expect(richToText('<p>a <b>b</b></p>')).toBe('a b');
  });
});
