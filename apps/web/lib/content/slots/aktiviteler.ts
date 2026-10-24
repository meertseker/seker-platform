import { YEAR_ROUND_BRANCHES } from '@/content/program';
import type { SlotDef } from '../types';
import { limitFor } from './limits';

const text = (label: string, def: string, heading = false): SlotDef => ({
  kind: 'text', label, default: def, max: limitFor(def, heading),
});

/** Branş dersleri sayfası. Dersler `program.branches` listesindedir. */
export const AKTIVITELER_SLOTS: Record<string, SlotDef> = {
  'meta.aktiviteler.title': { kind: 'text', label: 'Başlık', default: 'Branş Dersleri ve Aktiviteler', max: 70 },
  'meta.aktiviteler.description': {
    // Özgün metin Google'ın 160 karakterini aşıyor; sahibi ayarlar panelinden kısaltabilir.
    kind: 'text', label: 'Açıklama', max: 170,
    default:
      'Montessori, seramik, robotik & kodlama, satranç, müzik & ritim, bale & dans, drama, görsel sanatlar ve İngilizce. Beykent Büyükçekmece Özel Şeker Anaokulu branş dersleri.',
  },

  'aktiviteler.hero.eyebrow': text('Üst etiket', `${YEAR_ROUND_BRANCHES.length} ayrı çalışma alanı`),
  'aktiviteler.hero.title': text('Ana başlık', 'Branş Derslerimiz', true),
  'aktiviteler.hero.lead': text(
    'Giriş metni',
    'Çocukların farklı ilgi ve yetenek alanlarını denemesi için programımızı çeşitli branş ve çalışmalarla zenginleştiriyoruz. Aşağıda her dersin ne yaptığını ve neyi desteklediğini bulacaksınız.',
  ),

  'aktiviteler.tab.yearRound': text('Yıl boyu', 'Yıl boyu'),
  'aktiviteler.tab.summer': text('Yaz dönemi', 'Yaz dönemi'),
  'aktiviteler.season.yearRound.note': text(
    'Yıl boyu açıklaması',
    'Eğitim yılı boyunca haftalık programda yer alan dersler. Her biri alanında uzman bir öğretmenle yürüyor.',
  ),
  'aktiviteler.season.summer.note': text(
    'Yaz dönemi açıklaması',
    'Yaz döneminde programa eklenen çalışmalar. Yıl boyu süren dersler yaz aylarında da devam eder.',
  ),
  'aktiviteler.card.cta': text('Kart bağlantı yazısı', 'Ayrıntısını okuyun'),
  'aktiviteler.detail.gains': text('Kazanımlar başlığı', 'Neyi destekliyor?', true),

  'aktiviteler.cta.title': text('Başlık', 'Dersleri çalışırken görün', true),
  'aktiviteler.cta.lead': text(
    'Açıklama',
    'Randevunuzu branş dersinin olduğu bir saate alalım; çocukların nasıl çalıştığını kendiniz izleyin.',
  ),
};
