import { describe, it, expect, vi } from 'vitest';

vi.mock('../registry', () => ({
  SLOTS: {
    't.title': { kind: 'text', max: 10, default: 'x', label: 'Başlık' },
    't.year': { kind: 'text', max: 4, default: '2011', label: 'Yıl', pattern: '^(19|20)\\d{2}$' },
    't.fixed': {
      kind: 'list', label: 'Sabit', fixedItems: true, maxItems: 5,
      default: [{ id: 'a', q: 'x', on: true }, { id: 'b', q: 'y', on: false }],
      fields: { q: { kind: 'text', max: 5, label: 'S' }, on: { kind: 'flag', label: 'Yayında' } },
    },
    't.body': { kind: 'rich', max: 50, default: '<p>x</p>', label: 'Gövde' },
    't.img': { kind: 'image', default: { src: '/bahce-genis.webp', alt: 'a', width: 1, height: 1, assetId: null }, label: 'F' },
    't.opt': { kind: 'text', max: 10, default: 'x', label: 'Not', optional: true },
    't.optRich': { kind: 'rich', max: 50, default: '<p>x</p>', label: 'Ek', optional: true },
    't.sections': {
      kind: 'list', label: 'Bölümler', fixedItems: true, maxItems: 5,
      default: [{ id: 'montessori', p1: 'a', p4: 'b' }, { id: 'planlama', p1: 'c', p4: '' }],
      fields: {
        p1: { kind: 'text', max: 20, label: '1. paragraf' },
        p4: { kind: 'text', max: 20, label: '4. paragraf', optional: true },
        r: { kind: 'rich', max: 20, label: 'Not', optional: true },
      },
    },
    't.list': {
      kind: 'list', default: [], label: 'L', maxItems: 2,
      fields: { q: { kind: 'text', max: 5, label: 'S' }, on: { kind: 'flag', label: 'Yayında' } },
    },
  },
}));

import { validateEdits } from '../validate';

const e = (key: string, value: unknown) => [{ key, value, baseUpdatedAt: null }];

describe('validateEdits', () => {
  it('sınır doldurulmuş değere göre ölçülür; kayıtta belirteç korunur', () => {
    const vars = { yilSayisi: '15', kurulusYili: '2011' };
    // ham 13 karakter > 10, doldurulmuş 4 karakter
    expect(validateEdits(e('t.title', '{kurulusYili}'), vars)).toMatchObject({
      ok: true,
      edits: [{ value: '{kurulusYili}' }],
    });
    // doldurulmuş: "15" + 9 = 11 > 10
    expect(validateEdits(e('t.title', '{yilSayisi}abcdefghi'), vars).ok).toBe(false);
    expect(validateEdits(e('t.title', '{yilSayisi}abcdefgh'), vars).ok).toBe(true);
  });

  it('bilinmeyen anahtarı reddeder', () => {
    expect(validateEdits(e('yok', 'a'))).toMatchObject({ ok: false, key: 'yok' });
  });
  it('kind istemciden değil registryden gelir', () => {
    const r = validateEdits([{ key: 't.title', value: 'a', baseUpdatedAt: null, kind: 'rich' }]);
    expect(r).toEqual({ ok: true, edits: [{ key: 't.title', kind: 'text', value: 'a', baseUpdatedAt: null }] });
  });
  it('sınırda: 10 grafem kabul, 11 red', () => {
    expect(validateEdits(e('t.title', 'İğüşöçİğüş')).ok).toBe(true);
    expect(validateEdits(e('t.title', 'İğüşöçİğüşö')).ok).toBe(false);
    expect(validateEdits(e('t.title', '👨‍👩‍👧'.repeat(10))).ok).toBe(true);
  });
  it('boş ve yalnız boşluk reddedilir', () => {
    expect(validateEdits(e('t.title', '   ')).ok).toBe(false);
  });
  it('düz metinde satır sonu ve kontrol karakteri temizlenir', () => {
    expect(validateEdits(e('t.title', ' a\nb\u0007 '))).toMatchObject({ ok: true, edits: [{ value: 'a b' }] });
  });
  it('pattern uymazsa red', () => {
    expect(validateEdits(e('t.year', '11')).ok).toBe(false);
  });
  it('pattern uyarsa kabul (düzenli ifade gerçekten çalışır)', () => {
    expect(validateEdits(e('t.year', '2011'))).toMatchObject({ ok: true, edits: [{ value: '2011' }] });
  });
  it('sabit liste: sıra değişikliği reddedilir', () => {
    const r = validateEdits(e('t.fixed', [{ id: 'b', q: 'y', on: false }, { id: 'a', q: 'x', on: true }]));
    expect(r).toMatchObject({ ok: false, key: 't.fixed' });
  });
  it('sabit liste: madde eklenmesi reddedilir', () => {
    const r = validateEdits(e('t.fixed', [{ id: 'a', q: 'x', on: true }, { id: 'b', q: 'y', on: false }, { id: 'c', q: 'z', on: true }]));
    expect(r.ok).toBe(false);
  });
  it('sabit liste: madde silinmesi reddedilir', () => {
    expect(validateEdits(e('t.fixed', [{ id: 'a', q: 'x', on: true }])).ok).toBe(false);
  });
  it('sabit liste: aynı kimlikler, alanları düzenlenmiş hâli kabul edilir', () => {
    const r = validateEdits(e('t.fixed', [{ id: 'a', q: 'yeni', on: false }, { id: 'b', q: 'y', on: true }]));
    expect(r.ok).toBe(true);
  });
  it("Word'den yapıştırılan zengin metin izinli etiketlere iner", () => {
    const word =
      '<p class="MsoNormal"><span style="font-family:Calibri">Merhaba <b>dünya</b></span><o:p></o:p></p><script>alert(1)</script><a href="javascript:x">k</a>';
    const r = validateEdits(e('t.body', word));
    expect(r).toMatchObject({ ok: true, edits: [{ value: '<p>Merhaba <b>dünya</b></p><a>k</a>' }] });
  });
  it('dış görsel adresini reddeder', () => {
    expect(validateEdits(e('t.img', { src: 'https://evil.com/a.png', alt: 'a', width: 1, height: 1, assetId: null })).ok).toBe(false);
  });
  it('liste: tekrarlanan id ve fazla öğe reddedilir', () => {
    expect(validateEdits(e('t.list', [{ id: 'a', q: 'x', on: true }, { id: 'a', q: 'y', on: true }])).ok).toBe(false);
    expect(validateEdits(e('t.list', [{ id: 'a', q: 'x' }, { id: 'b', q: 'y' }, { id: 'c', q: 'z' }])).ok).toBe(false);
    expect(validateEdits(e('t.list', [{ id: 'a', q: 'x', on: 'evet' }])).ok).toBe(false);
  });
  it('null varsayılana dönüş olarak kabul edilir', () => {
    expect(validateEdits(e('t.title', null))).toMatchObject({ ok: true, edits: [{ value: null }] });
  });
});

describe('isteğe bağlı (optional) alanlar', () => {
  it('isteğe bağlı metin boş kaydedilir; değer null değil boş metindir (varsayılana dönmez)', () => {
    expect(validateEdits(e('t.opt', ''))).toEqual({ ok: true, edits: [{ key: 't.opt', kind: 'text', value: '', baseUpdatedAt: null }] });
    expect(validateEdits(e('t.opt', '  \n '))).toMatchObject({ ok: true, edits: [{ value: '' }] });
  });
  it('isteğe bağlı zengin metin boş kaydedilir', () => {
    expect(validateEdits(e('t.optRich', '<p> </p>'))).toMatchObject({ ok: true, edits: [{ value: '' }] });
  });
  it('isteğe bağlı alanda da sınır geçerlidir', () => {
    expect(validateEdits(e('t.opt', 'çok uzun bir not')).ok).toBe(false);
  });
  it('zorunlu alan boşken hâlâ hata verir', () => {
    expect(validateEdits(e('t.title', ''))).toMatchObject({ ok: false, error: 'Başlık boş bırakılamaz.' });
    expect(validateEdits(e('t.body', '<p></p>'))).toMatchObject({ ok: false, error: 'Gövde boş bırakılamaz.' });
  });
  it('liste: isteğe bağlı paragraf boşaltılabilir, diğer maddelerin boş paragrafı kaydı engellemez', () => {
    const r = validateEdits(e('t.sections', [{ id: 'montessori', p1: 'kısa', p4: '', r: '' }, { id: 'planlama', p1: 'c', p4: '' }]));
    expect(r).toMatchObject({
      ok: true,
      edits: [{ value: [{ id: 'montessori', p1: 'kısa', p4: '', r: '' }, { id: 'planlama', p1: 'c', p4: '' }] }],
    });
  });
  it('liste: zorunlu alan boşken hâlâ hata verir', () => {
    expect(validateEdits(e('t.sections', [{ id: 'montessori', p1: ' ', p4: 'b' }, { id: 'planlama', p1: 'c', p4: '' }]))).toMatchObject({
      ok: false,
      error: '1. paragraf boş bırakılamaz.',
    });
  });
  it('liste: büyük harfli madde kimliği (ör. mudKitchen) kabul edilir', () => {
    expect(validateEdits(e('t.list', [{ id: 'mudKitchen', q: 'x' }])).ok).toBe(true);
  });
});
