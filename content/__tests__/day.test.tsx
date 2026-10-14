import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DAY_CHAPTERS, SCHEDULE_READY, ROSTER_STATUS, ENGLISH_COVERAGE_READY, chapterLabel } from '../day';
import { MEDIA } from '../media';
import TimeSpine from '@/app/components/cine/TimeSpine';
import DayChapters from '@/app/components/cine/DayChapters';

describe('DAY_CHAPTERS', () => {
  it('en az sekiz bölüm içerir', () => {
    expect(DAY_CHAPTERS.length).toBeGreaterThanOrEqual(8);
  });

  it('id değerleri benzersizdir', () => {
    const ids = DAY_CHAPTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('dahili saat referansları kronolojik sıradadır', () => {
    const minutes = DAY_CHAPTERS.map((c) => {
      const [h, m] = c.time.split(':').map(Number);
      return h * 60 + m;
    });
    expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
  });

  it('her bölüm geçerli bir görsel anahtarı kullanır', () => {
    for (const chapter of DAY_CHAPTERS) {
      expect(MEDIA[chapter.mediaKey]).toBeDefined();
    }
  });

  it('künye yalnızca tek bölümde öne çıkar — scaling disiplini', () => {
    expect(DAY_CHAPTERS.filter((c) => c.feature === 'roster')).toHaveLength(1);
  });

  it('yasak kelime ve ücret rakamı içermez', () => {
    const text = JSON.stringify(DAY_CHAPTERS);
    for (const word of ['indirim', 'kampanya', 'uygun fiyat', 'bütçe dostu', 'fırsat']) {
      expect(text.toLowerCase()).not.toContain(word);
    }
    expect(text).not.toMatch(/\d{3}\.\d{3}/);
    expect(text).not.toContain('₺');
  });

  it('desteklenemeyen İngilizce ve "native" iddiası içermez (asset dosyası §5.2)', () => {
    const text = JSON.stringify(DAY_CHAPTERS).toLowerCase();
    expect(text).not.toContain('native');
    expect(text).not.toContain('mezun olan çocuklarımız ingilizce konuşuyor');
    expect(text).not.toContain('mezun olduğunda ingilizce konuşuyor');
    // §5.2'nin kendi tablosunda bile ⚠️TEYİT işaretli tek satır — doğrulama
    // kuyruğu #3 kapanmadan öğretmenin günlük İngilizce kapsamı/süresi
    // iddia edilemez (bkz. ENGLISH_COVERAGE_READY kapısı aşağıda).
    expect(text).not.toMatch(/gün boyunca kullan/);
    expect(text).not.toContain('sadece ders saatinde değil');
  });

  it('bölüm metinleri kesin sınıf/öğretmen sayısını iddia olarak yazmaz (doğrulama kuyruğu #1, #2)', () => {
    // title/lead/body metninde rakam yok — rakam yalnızca dahili `time` alanında olabilir.
    for (const chapter of DAY_CHAPTERS) {
      const prose = [chapter.title, chapter.lead, ...chapter.body].join(' ');
      expect(prose).not.toMatch(/\d/);
    }
  });
});

describe('saat doğrulama kapısı — SCHEDULE_READY', () => {
  it('okul saatlik akışı henüz doğrulamadı, bu yüzden bayrak false olmalı', () => {
    // Bu test, birisi veriyi doğrulamadan bayrağı unutup true yaparsa kırmızı olsun diye burada.
    expect(SCHEDULE_READY).toBe(false);
  });

  it('SCHEDULE_READY false iken chapterLabel hiçbir bölüm için gerçek saat döndürmez', () => {
    for (const chapter of DAY_CHAPTERS) {
      expect(chapterLabel(chapter)).not.toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it('TimeSpine ilk sahneyi okur buradasınız diye işaretler', () => {
    const { container } = render(<TimeSpine chapters={DAY_CHAPTERS} />);
    const active = container.querySelectorAll('[data-active="true"]');
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toContain(DAY_CHAPTERS[0].title);
  });

  it('TimeSpine, saat doğrulanmadan hiçbir HH:MM saatini render etmez', () => {
    const { container } = render(<TimeSpine chapters={DAY_CHAPTERS} />);
    const text = container.textContent ?? '';
    for (const chapter of DAY_CHAPTERS) {
      expect(text).not.toContain(chapter.time);
    }
    expect(text).not.toMatch(/\d{2}:\d{2}/);
  });

  it('DayChapters bölüm listesi de doğrulanmamış saatleri render etmez', () => {
    const { container } = render(<DayChapters chapters={DAY_CHAPTERS} />);
    const text = container.textContent ?? '';
    for (const chapter of DAY_CHAPTERS) {
      expect(text).not.toContain(chapter.time);
    }
    expect(text).not.toMatch(/\d{2}:\d{2}/);
  });
});

describe('İngilizce kapsam doğrulama kapısı — ENGLISH_COVERAGE_READY', () => {
  it('okul günlük İngilizce kapsamını doğruladı (1 Ağustos 2026)', () => {
    expect(ENGLISH_COVERAGE_READY).toBe(true);
  });

  it('ENGLISH_COVERAGE_READY false iken DayChapters öğretmenin günlük kapsamını iddia etmez', () => {
    const { container } = render(<DayChapters chapters={DAY_CHAPTERS} />);
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toMatch(/gün boyunca kullan/);
    expect(text).not.toContain('sadece ders saatinde değil');
  });
});

describe('künye doğrulama kapısı — ROSTER_STATUS', () => {
  it('okul sınıf mevcudunu doğruladı (1 Ağustos 2026)', () => {
    expect(ROSTER_STATUS.ready).toBe(true);
  });

  it('ROSTER_STATUS.ready true iken künye (Roster) çocuk ve öğretmen işaretlerini gösterir', () => {
    const { container } = render(<DayChapters chapters={DAY_CHAPTERS} />);
    expect(container.querySelectorAll('[data-mark="child"]')).toHaveLength(ROSTER_STATUS.childCount);
    expect(container.querySelectorAll('[data-mark="teacher"]')).toHaveLength(
      ROSTER_STATUS.teacherCount,
    );
  });
});
