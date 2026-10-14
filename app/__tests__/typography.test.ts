import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
const layout = readFileSync(path.join(process.cwd(), 'app', 'layout.tsx'), 'utf8');
const siteLayout = readFileSync(path.join(process.cwd(), 'app', '(site)', 'layout.tsx'), 'utf8');
const nextConfig = readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8');

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
  it.each(['Fredoka', 'Nunito', 'Martian_Mono'])(
    '%s next/font ile yükleniyor',
    (family) => {
      expect(layout).toContain(family);
    },
  );

  it('Türkçe karakterler için latin-ext alt kümesi isteniyor', () => {
    expect(layout).toContain('latin-ext');
  });
});

describe('mark disiplini — tek vurgu rengi, tek görev', () => {
  // --color-mark yalnızca künye işaretleri (Roster bileşeni) ve odak halkaları için var.
  // Yeni bir dosya bu listeye girmeden text-mark/bg-mark/border-mark/ring-mark kullanırsa
  // bu test kırmızıya döner. Roster bileşeni eklendiğinde onun yolunu da listeye ekleyin.
  const ALLOWED_MARK_FILES = [
    path.join('app', 'components', 'LeadForm.tsx'), // focus:border-mark / focus:ring-mark — odak halkası
    path.join('app', 'components', 'cine', 'Roster.tsx'), // künye işaretleri (henüz oluşturulmadı)
  ];

  function findMarkUsages(dir: string, offenders: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__tests__') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findMarkUsages(full, offenders);
      } else if (/\.(tsx|ts)$/.test(entry.name)) {
        const content = readFileSync(full, 'utf8');
        if (/\b(?:text|bg|border|ring)-mark\b/.test(content)) {
          const relative = path.relative(process.cwd(), full);
          if (!ALLOWED_MARK_FILES.includes(relative)) {
            offenders.push(relative);
          }
        }
      }
    }
    return offenders;
  }

  it('mark sınıfı yalnızca izin verilen dosyalarda (künye işaretleri, odak halkaları) kullanılıyor', () => {
    const offenders = findMarkUsages(path.join(process.cwd(), 'app'));
    expect(offenders).toEqual([]);
  });
});

describe('kesintisiz kabuk', () => {
  it('site layout Header taşır — sayfalar yeniden doğurmaz', () => {
    expect(siteLayout).toContain('<Header');
  });

  it('view transition açılmıştır', () => {
    expect(nextConfig).toContain('viewTransition: true');
    expect(css).toContain('@view-transition');
  });

  it('hareket azaltılınca view transition kapanır', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('navigation: none');
  });
});
