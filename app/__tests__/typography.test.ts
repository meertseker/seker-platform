import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
const layout = readFileSync(path.join(process.cwd(), 'app', 'layout.tsx'), 'utf8');

describe('tasarım tokenları', () => {
  it.each([
    '--color-paper', '--color-paper-warm', '--color-ink', '--color-ink-soft',
    '--color-rule', '--color-mark',
    '--color-dawn', '--color-morning', '--color-midday', '--color-golden', '--color-dusk',
  ])('%s tanımlı', (token) => {
    expect(css).toContain(token);
  });

  it('üç font rolü tanımlı', () => {
    expect(css).toContain('--font-display');
    expect(css).toContain('--font-body');
    expect(css).toContain('--font-mono');
  });

  it('eski lacivert/altın paleti kaldırıldı', () => {
    expect(css).not.toContain('--color-navy-');
    expect(css).not.toContain('--color-gold-');
  });
});

describe('font yüklemesi', () => {
  it.each(['Bricolage_Grotesque', 'Newsreader', 'Martian_Mono'])(
    '%s next/font ile yükleniyor',
    (family) => {
      expect(layout).toContain(family);
    },
  );

  it('Türkçe karakterler için latin-ext alt kümesi isteniyor', () => {
    expect(layout).toContain('latin-ext');
  });
});
