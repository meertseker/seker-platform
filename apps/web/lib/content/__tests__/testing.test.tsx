import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { uncoveredText, sentinelData } from '../testing';

describe('uncoveredText', () => {
  it('slot dışı metni yakalar, sentinel ve rakamları yok sayar', () => {
    const { container } = render(
      <div>
        <h1>⟦home.hero.title⟧</h1>
        <p>Elle yazılmış cümle</p>
        <span aria-hidden="true">dekor</span>
        <span>12 · 3</span>
        <svg><text>ikon</text></svg>
      </div>,
    );
    expect(uncoveredText(container)).toEqual(['Elle yazılmış cümle']);
  });
  it('sentinelData her metni anahtarla doldurur', () => {
    expect(sentinelData(['site.']).values['site.phone']).toBe('⟦site.phone⟧');
  });
});
