import { vi, describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import fixture from './fixtures/prod-keys-2026-10-24.json';
import { SLOTS } from '../registry';
import { sentinelData } from '../testing';
import { pickData } from '../reader';
import HomeView from '@/app/(site)/HomeView';
import HakkimizdaView from '@/app/(site)/hakkimizda/HakkimizdaView';
import EgitimView from '@/app/(site)/egitim-yaklasimimiz/EgitimView';
import GunlukAkisView from '@/app/(site)/gunluk-akis/GunlukAkisView';
import AktivitelerView from '@/app/(site)/aktiviteler/AktivitelerView';
import BranchExplorer from '@/app/(site)/aktiviteler/BranchExplorer';
import AgeGroupsIndexView from '@/app/(site)/yas-gruplari/AgeGroupsIndexView';
import AgeGroupView from '@/app/(site)/yas-gruplari/[slug]/AgeGroupView';
import KayitView from '@/app/(site)/kayit/KayitView';
import IletisimView from '@/app/(site)/iletisim/IletisimView';
import SSS from '@/app/(site)/sss/SSS';
import YorumlarView from '@/app/(site)/veli-yorumlari/YorumlarView';
import TesekkurlerView from '@/app/(site)/tesekkurler/TesekkurlerView';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import MobileActionBar from '@/app/components/MobileActionBar';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/', notFound: vi.fn() }));

/**
 * Okul personelinin (Zehra) panelden yazdığı metinler prod `site_content` tablosunda durur.
 * Bir anahtar kayıt defterinden silinir ya da adı değişirse o metin sitede kaybolur; bir liste
 * maddesinin id'si ya da alan adı değişirse kayıt o alanı taşımaz. Bu test, 24.10.2026'da çekilen
 * prod anahtar listesine (yalnızca anahtarlar, id'ler ve alan adları; metinler yok) karşı:
 *   1. her anahtarın aynı türle tanımlı olduğunu,
 *   2. her liste maddesinin id'sinin varsayılanda durduğunu ve alanlarının tanımlı olduğunu,
 *   3. her anahtarın (liste maddelerinde en az bir metin alanının) sitenin bir sayfasında basıldığını
 * doğrular. Prod'dan yeni çekim yapıldığında fixture dosyası yenilenir.
 */
type Entry = { key: string; kind: 'text' | 'list'; items?: { id: string; fields: string[] }[] };
const entries = fixture.entries as Entry[];

/** Bütün alanlar sentinel değerle (⟦anahtar⟧ / ⟦anahtar:id.alan⟧) doldurulur; her sayfa basılır ve HTML birleştirilir. */
function renderSite(): string {
  const data = sentinelData(['']);
  const ageSlugs = (data.values['ageGroups.items'] as { id: string }[]).map((g) => g.id);
  const summer = (data.values['program.branches'] as { id: string; season: string }[]).find((b) => b.season === 'yaz')!.id;
  const views = [
    <HomeView key="home" data={data} />,
    <HakkimizdaView key="hakkimizda" data={data} />,
    <EgitimView key="egitim" data={data} />,
    <GunlukAkisView key="gunlukakis" data={data} />,
    <AktivitelerView key="aktiviteler" data={data} />,
    <BranchExplorer key="yaz" data={pickData(data, ['program.', 'aktiviteler.', 'media.'])} initialSlug={summer} />,
    <AgeGroupsIndexView key="yasgruplari" data={data} />,
    ...ageSlugs.map((slug) => <AgeGroupView key={slug} data={data} slug={slug} />),
    <KayitView key="kayit" data={data} />,
    <IletisimView key="iletisim" data={data} />,
    <SSS key="sss" data={data} />,
    <YorumlarView key="yorumlar" data={data} />,
    <TesekkurlerView key="tesekkurler" data={data} />,
    <Header key="header" data={data} />,
    <Footer key="footer" year={2026} data={data} />,
    <MobileActionBar key="bar" data={data} />,
  ];
  return views.map((v) => render(v).container.innerHTML).join('\n');
}

describe('okul personelinin prod kayıtları (site_content, 24.10.2026) korunuyor', () => {
  it('fixture boş değil', () => {
    expect(entries.length).toBeGreaterThanOrEqual(45);
  });

  it.each(entries.map((e) => [e.key, e] as const))('%s kayıt defterinde aynı türle tanımlı', (_key, entry) => {
    const def = SLOTS[entry.key];
    expect(def, entry.key).toBeDefined();
    expect(def.kind).toBe(entry.kind);
    if (entry.kind !== 'list') return;
    const defaults = def.default as { id: string }[];
    for (const item of entry.items!) {
      const d = defaults.find((x) => x.id === item.id);
      expect(d, `${entry.key}: ${item.id}`).toBeDefined();
      for (const field of item.fields) {
        // Düzenlenebilir alan (fields) ya da kayıtta olduğu gibi taşınan sabit alan (mediaKey, season, grade…).
        expect(field in (def.fields ?? {}) || field in d!, `${entry.key}: ${item.id}.${field}`).toBe(true);
      }
    }
  });

  const html = renderSite();

  it.each(entries.map((e) => [e.key, e] as const))('%s sitede basılıyor', (_key, entry) => {
    const def = SLOTS[entry.key];
    if (entry.kind === 'text') {
      expect(html, entry.key).toContain(`⟦${entry.key}⟧`);
      return;
    }
    const textFields = Object.entries(def.fields ?? {}).filter(([, f]) => f.kind === 'text').map(([name]) => name);
    const defaults = def.default as ({ id: string } & Record<string, unknown>)[];
    for (const item of entry.items!) {
      // "Yayında" kapalı madde (ready: false) bilerek hiçbir yerde basılmaz; sentinel veri varsayılan bayrağı taşır.
      if (defaults.find((d) => d.id === item.id)?.ready === false) continue;
      const shown = textFields.some((f) => html.includes(`⟦${entry.key}:${item.id}.${f}⟧`));
      expect(shown, `${entry.key}: ${item.id} hiçbir sayfada basılmıyor`).toBe(true);
    }
  });
});
