import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import JsonLd from '@/app/components/JsonLd';
import { buildPreschoolSchema } from '@/lib/schema';
import { makeReader } from '@/lib/content/reader';
import { defaultData } from '@/lib/content/testing';

describe('JsonLd kaçışı', () => {
  it('düzenlenebilir metin script etiketinden çıkamaz ve değer aynen geri okunur', () => {
    const evil = '</script><script>alert(1)</script>' + String.fromCharCode(0x2028) + 'x';
    const data = defaultData();
    data.values['site.name'] = evil;
    const { container } = render(<JsonLd data={buildPreschoolSchema(makeReader(data))} />);
    const text = container.querySelector('script')!.innerHTML;
    expect(text.toLowerCase()).not.toContain('</script');
    expect(text).not.toContain('<');
    expect(JSON.parse(text).name).toBe(evil);
  });
});
