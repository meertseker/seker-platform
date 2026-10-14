import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Roster from '../Roster';

describe('Roster', () => {
  it('verilen sayıda çocuk ve öğretmen işareti çizer', () => {
    const { container } = render(<Roster childCount={10} teacherCount={2} limit={20} />);
    expect(container.querySelectorAll('[data-mark="child"]')).toHaveLength(10);
    expect(container.querySelectorAll('[data-mark="teacher"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-mark="limit"]')).toHaveLength(20);
  });

  it('farklı mevcut için doğru sayıda işaret çizer', () => {
    const { container } = render(<Roster childCount={8} teacherCount={2} />);
    expect(container.querySelectorAll('[data-mark="child"]')).toHaveLength(8);
  });

  it('ekran okuyucu için metin karşılığı sunar', () => {
    const { getByText } = render(<Roster childCount={10} teacherCount={2} limit={20} />);
    expect(
      getByText(/10 çocuk, 2 öğretmen/i),
    ).toBeDefined();
  });

  it('limit verilmezse karşılaştırma satırı çizilmez', () => {
    const { container } = render(<Roster childCount={10} teacherCount={2} />);
    expect(container.querySelectorAll('[data-mark="limit"]')).toHaveLength(0);
  });
});
