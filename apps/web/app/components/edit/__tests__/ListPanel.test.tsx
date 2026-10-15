import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ListPanel } from '../ListPanel';

afterEach(cleanup);

const meta = {
  kind: 'list' as const,
  label: 'Sıkça sorulanlar',
  maxItems: 3,
  fields: {
    question: { kind: 'text' as const, max: 120, label: 'Soru' },
    answer: { kind: 'text' as const, max: 600, label: 'Cevap' },
    featured: { kind: 'flag' as const, label: 'Ana sayfada göster' },
  },
};
const value = [
  { id: 'a', question: 'S1', answer: 'C1', featured: true },
  { id: 'b', question: 'S2', answer: 'C2', featured: false },
];

describe('ListPanel', () => {
  it('aşağı taşır', () => {
    const onChange = vi.fn();
    render(<ListPanel listKey="faq.items" meta={meta} value={value} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Aşağı taşı' })[0]);
    expect(onChange).toHaveBeenCalledWith([value[1], value[0]]);
  });
  it('siler (onaydan sonra)', () => {
    const onChange = vi.fn();
    render(<ListPanel listKey="faq.items" meta={meta} value={value} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));
    expect(onChange).toHaveBeenCalledWith([value[1]]);
  });
  it('ekler; yeni öğe benzersiz id ve boş alanlarla gelir', () => {
    const onChange = vi.fn();
    render(<ListPanel listKey="faq.items" meta={meta} value={value} onChange={onChange} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Madde ekle' }));
    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(3);
    expect(next[2].id).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(next[2]).toMatchObject({ question: '', answer: '', featured: false });
  });
  it('maxItems dolunca ekleme pasif', () => {
    render(
      <ListPanel listKey="faq.items" meta={{ ...meta, maxItems: 2 }} value={value} onChange={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Madde ekle' })).toBeDisabled();
  });
  it('fixedItems: ekle/sil/taşı denetimleri gizlenir, alan düzenleme kalır', () => {
    render(
      <ListPanel listKey="faq.items" meta={{ ...meta, fixedItems: true }} value={value} onChange={() => {}} onClose={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: 'Madde ekle' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sil' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aşağı taşı' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Yukarı taşı' })).toBeNull();
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });
  it('newItem alanları yeni öğeye yayılır', () => {
    const onChange = vi.fn();
    render(
      <ListPanel
        listKey="faq.items"
        meta={{ ...meta, newItem: { question: 'Yeni soru', featured: true } }}
        value={value}
        onChange={onChange}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Madde ekle' }));
    const added = onChange.mock.calls[0][0][2];
    expect(added).toMatchObject({ question: 'Yeni soru', featured: true });
    expect(added.id).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
