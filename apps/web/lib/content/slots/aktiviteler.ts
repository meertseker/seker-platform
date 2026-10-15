import { YEAR_ROUND_BRANCHES } from '@/content/program';
import type { SlotDef } from '../types';
import { limitFor } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

/** Branş dersleri sayfası. Dersler `program.branches`, haftalık günler `program.weekDays` listesindedir. */
export const AKTIVITELER_SLOTS: Record<string, SlotDef> = {
  'meta.aktiviteler.title': { kind: 'text', label: 'Sayfa başlığı (Google)', default: 'Branş Dersleri ve Aktiviteler', max: 70 },
  'meta.aktiviteler.description': {
    // Özgün metin Google'ın 160 karakterini aşıyor; sahibi ayarlar panelinden kısaltabilir.
    kind: 'text', label: 'Sayfa açıklaması (Google)', max: 170,
    default:
      'Montessori, seramik, robotik & kodlama, satranç, müzik & ritim, bale & dans, drama, görsel sanatlar ve İngilizce. Beykent Büyükçekmece Özel Şeker Anaokulu branş dersleri.',
  },

  'aktiviteler.hero.eyebrow': text('Üst etiket', `${YEAR_ROUND_BRANCHES.length} ayrı çalışma alanı`),
  'aktiviteler.hero.title': text('Ana başlık', 'Branş Derslerimiz', true),
  'aktiviteler.hero.lead': text(
    'Giriş metni',
    'Çocukların farklı ilgi ve yetenek alanlarını denemesi için programımızı çeşitli branş ve çalışmalarla zenginleştiriyoruz. Aşağıda her dersin ne yaptığını ve neyi desteklediğini bulacaksınız.',
  ),

  'aktiviteler.tab.yearRound': text('Yıl boyu sekmesi', 'Yıl boyu'),
  'aktiviteler.tab.summer': text('Yaz dönemi sekmesi', 'Yaz dönemi'),
  'aktiviteler.season.yearRound.note': text(
    'Yıl boyu sekmesi açıklaması',
    'Eğitim yılı boyunca haftalık programda yer alan dersler. Her biri alanında uzman bir öğretmenle yürüyor.',
  ),
  'aktiviteler.season.summer.note': text(
    'Yaz dönemi sekmesi açıklaması',
    'Yaz döneminde programa eklenen çalışmalar. Yıl boyu süren dersler yaz aylarında da devam eder.',
  ),
  'aktiviteler.card.cta': text('Kart bağlantı yazısı', 'Ayrıntısını okuyun'),
  'aktiviteler.detail.gains': text('Kazanımlar başlığı', 'Neyi destekliyor?', true),

  'aktiviteler.week.title': text('Haftalık günler başlığı', 'Haftalık özel günlerimiz', true),
  'aktiviteler.week.lead': text(
    'Haftalık günler açıklaması',
    'Okul yaşamını daha keyifli hâle getirmek için haftanın belirli günlerinde özel etkinlikler düzenliyoruz.',
  ),
  'aktiviteler.cta.title': text('Form başlığı', 'Dersleri çalışırken görün', true),
  'aktiviteler.cta.lead': text(
    'Form üstü metin',
    'Randevunuzu branş dersinin olduğu bir saate alalım; çocukların nasıl çalıştığını kendiniz izleyin.',
  ),
};
