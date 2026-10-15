import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Editable, EditableRich } from '../Editable';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';

const base: ReaderData = {
  values: { 't.title': 'Merhaba', 't.body': '<p>Bir <strong>iki</strong></p>', 't.list': [{ id: 'a', q: 'Soru' }] },
  updatedAt: {},
  meta: {
    't.title': { kind: 'text', max: 40, label: 'Başlık' },
    't.body': { kind: 'rich', max: 2000, label: 'Gövde' },
    't.list': { kind: 'list', label: 'Liste', fields: { q: { kind: 'text', max: 50, label: 'Soru' } } },
  },
  editing: false,
  vars: { yilSayisi: '15', kurulusYili: '2011' },
};

describe('Editable', () => {
  it('ziyaretçide orijinal elemanı birebir üretir', () => {
    const { container } = render(<Editable c={makeReader(base)} k="t.title" as="h1" className="mt-4 text-ink" />);
    expect(container.innerHTML).toBe('<h1 class="mt-4 text-ink">Merhaba</h1>');
  });
  it('düzenlemede data-edit öznitelikleri ekler', () => {
    const { container } = render(<Editable c={makeReader({ ...base, editing: true })} k="t.title" as="h1" />);
    expect(container.innerHTML).toBe(
      '<h1 data-edit-key="t.title" data-edit-kind="text" data-edit-max="40">Merhaba</h1>',
    );
  });
  it('liste alanı path ve value ile', () => {
    const c = makeReader({ ...base, editing: true });
    const item = c.list<{ id: string; q: string }>('t.list')[0];
    const { container } = render(<Editable c={c} k="t.list" path={`${item.id}.q`} value={item.q} as="dt" />);
    expect(container.querySelector('dt')!.getAttribute('data-edit-path')).toBe('a.q');
    expect(container.textContent).toBe('Soru');
  });
  it('liste alanındaki {yilSayisi} belirtecini value üzerinden doldurur', () => {
    const c = makeReader(base);
    const { container } = render(
      <Editable c={c} k="t.list" path="a.q" value="{yilSayisi} yıldır buradayız" as="dt" />,
    );
    expect(container.textContent).toBe('15 yıldır buradayız');
  });
});

describe('EditableRich', () => {
  it('temizlenmiş HTML basar', () => {
    const { container } = render(<EditableRich c={makeReader(base)} k="t.body" className="prose" />);
    expect(container.innerHTML).toBe('<div class="prose"><p>Bir <strong>iki</strong></p></div>');
  });
  it('value içindeki {kurulusYili} belirtecini doldurur', () => {
    const { container } = render(
      <EditableRich c={makeReader(base)} k="t.body" value="<p>{kurulusYili} yılından beri</p>" />,
    );
    expect(container.innerHTML).toBe('<div><p>2011 yılından beri</p></div>');
  });
});
