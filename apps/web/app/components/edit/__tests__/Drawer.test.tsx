import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { Drawer } from '../Drawer';
import type { ListItem } from '@/lib/content/types';
import { ListPanel } from '../ListPanel';

afterEach(cleanup);

const meta = {
  kind: 'list' as const,
  label: 'Liste',
  fields: { question: { kind: 'text' as const, max: 120, label: 'Soru' } },
};

function Parent() {
  const [value, setValue] = useState<ListItem[]>([{ id: 'a', question: '' }]);
  // Her render'da yeni onClose (satır içi ok), gerçek EditBarExtras gibi.
  return (
    <Drawer title="Kap" onClose={() => {}}>
      <ListPanel listKey="k" meta={meta} value={value} onChange={setValue} onClose={() => {}} />
    </Drawer>
  );
}

describe('Drawer odağı', () => {
  it('yazarken odak girdide kalır', () => {
    render(<Parent />);
    const ta = screen.getAllByRole('textbox')[0] as HTMLTextAreaElement;
    ta.focus();
    fireEvent.change(ta, { target: { value: 'a' } });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'ab' } });
    const now = screen.getAllByRole('textbox')[0] as HTMLTextAreaElement;
    expect(now.value).toBe('ab');
    expect(document.activeElement).toBe(now);
  });
  it('Escape güncel onClose çağırır', () => {
    let n = 0;
    render(<Drawer title="x" onClose={() => n++}>i</Drawer>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(n).toBe(1);
  });
});
