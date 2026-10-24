import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cloneElement, type ReactElement } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import Page from '@/app/(site)/aktiviteler/page';
import AktivitelerView from '@/app/(site)/aktiviteler/AktivitelerView';
import BranchExplorer from '@/app/(site)/aktiviteler/BranchExplorer';
import { defaultData, sentinelData, uncoveredText } from '@/lib/content/testing';
import { pickData } from '@/lib/content/reader';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), notFound: vi.fn() }));
vi.mock('@/lib/content/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/content/server')>();
  return { ...actual, getReaderData: async () => actual.buildReaderData({}, false, new Date().getFullYear()) };
});

const PREFIXES = ['aktiviteler.', 'meta.aktiviteler.', 'program.', 'media.'];

describe('aktiviteler ziyaretçi HTML', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00+03:00'));
  });
  afterEach(() => vi.useRealTimers());

  // Anlık görüntü sayfanın gerçek bileşimiyle (searchParams Suspense sarmalı dahil) alındı; ilk yıl boyu dersi seçili.
  it('düzenleme katmanından önceki hâliyle aynı', async () => {
    // Async sunucu bileşeni (BranchFromParams) önce sunucuda olduğu gibi çözülür; sonra renderToString ile
    // efekt çalıştırmadan sunucu HTML'i alınır (istemci efektleri landingPath gibi alanları değiştirirdi).
    const page = (await Page({ searchParams: Promise.resolve({}) })) as ReactElement<{ explorer: ReactElement<{ children: ReactElement<Record<string, unknown>> }> }>;
    const child = page.props.explorer?.props?.children;
    if (typeof child?.type !== 'function') throw new Error('aktiviteler sayfa yapısı değişti: BranchFromParams bulunamadı');
    const resolved = await (child.type as (p: unknown) => Promise<ReactElement>)(child.props);
    const html = renderToString(cloneElement(page as ReactElement<{ explorer?: unknown }>, { explorer: resolved }));
    const container = document.createElement('div');
    container.innerHTML = html;
    // style özniteliği jsdom'un biçimine normalleştirilir (anlık görüntü biçimi korunur).
    container.querySelectorAll<HTMLElement>('[style]').forEach((el) => el.setAttribute('style', el.style.cssText));
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('ziyaretçiye düzenleme öznitelikleri gitmez', () => {
    expect(render(<AktivitelerView data={defaultData(PREFIXES)} />).container.innerHTML).not.toContain('data-edit-');
  });

  it('düzenleme modunda dersler ve metinler işaretlenir', () => {
    const { container } = render(<AktivitelerView data={{ ...defaultData(PREFIXES), editing: true }} />);
    for (const key of ['aktiviteler.hero.title', 'aktiviteler.cta.lead', 'aktiviteler.detail.gains']) {
      expect(container.querySelector(`[data-edit-key="${key}"]`), key).not.toBeNull();
    }
    for (const list of ['program.branches']) {
      expect(container.querySelector(`[data-edit-list="${list}"]`), list).not.toBeNull();
    }
    for (const path of ['montessori.name', 'montessori.summary', 'montessori.body1', 'montessori.gain5', 'seramik.name']) {
      expect(container.querySelector(`[data-edit-key="program.branches"][data-edit-path="${path}"]`), path).not.toBeNull();
    }
    // Haftalık özel günler bu sayfadan kalktı; program.weekDays Günlük Akış sayfasında.
    expect(container.querySelector('[data-edit-list="program.weekDays"]')).toBeNull();
  });

  it('?ders= ile yaz dersi ve sekme geçişi çalışır; ayrıntı panosu seçili dersin alanlarını basar', () => {
    const data = pickData(defaultData(PREFIXES), ['program.', 'aktiviteler.', 'media.']);
    const { container, getByRole } = render(<BranchExplorer data={data} initialSlug="binicilik" />);
    expect(container.querySelector('#ders-detay')?.textContent).toContain('Yaz döneminde çocuklarımız binicilik çalışmalarına katılır.');
    fireEvent.click(getByRole('tab', { name: 'Yıl boyu' }));
    expect(container.querySelector('#ders-detay')?.textContent).toContain('Okulumuzda haftanın beş günü Montessori');
  });

  it('görünür her metin bir içerik alanından geliyor', () => {
    const { container } = render(<AktivitelerView data={sentinelData(PREFIXES)} />);
    container.querySelectorAll('form').forEach((el) => el.remove());
    expect(uncoveredText(container)).toEqual([]);
  });
});
