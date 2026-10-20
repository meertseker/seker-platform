import { describe, it, expect, vi } from 'vitest';
import { plainTextFromPaste, beginTextEdit } from '../TextEditing';

describe('plainTextFromPaste', () => {
  it("Word HTML'i yerine düz metni alır", () => {
    const e = {
      clipboardData: {
        getData: (t: string) => (t === 'text/plain' ? 'Merhaba\r\ndünya' : '<p class="MsoNormal"><b>Merhaba</b></p>'),
      },
    } as unknown as ClipboardEvent;
    expect(plainTextFromPaste(e)).toBe('Merhaba dünya');
  });
});

describe('beginTextEdit', () => {
  it('Esc eski metne döner, Enter onaylar', () => {
    const el = document.createElement('h1');
    el.textContent = 'Eski';
    document.body.append(el);
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const stop = beginTextEdit(el, { max: 20, onCommit, onCancel, onCount: () => {} });
    expect(el.isContentEditable || el.getAttribute('contenteditable')).toBeTruthy();
    el.textContent = 'Yeni metin';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith('Yeni metin');
    stop();

    const stop2 = beginTextEdit(el, { max: 20, onCommit, onCancel, onCount: () => {} });
    el.textContent = 'Vazgeçilecek';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.textContent).toBe('Yeni metin');
    expect(onCancel).toHaveBeenCalled();
    stop2();
  });
});

describe('beginTextEdit sınır ve temizlik', () => {
  const mk = (text: string) => {
    const el = document.createElement('h1');
    el.textContent = text;
    document.body.append(el);
    return el;
  };
  const enter = (el: HTMLElement) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

  it('sınırı aşan metin onaylanmaz, düzenleme sürer', () => {
    const el = mk('Eski');
    const onCommit = vi.fn();
    const onReject = vi.fn();
    const stop = beginTextEdit(el, { max: 5, onCommit, onCancel: () => {}, onCount: () => {}, onReject });
    el.textContent = 'Çok uzun metin';
    enter(el);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledWith(5);
    expect(el.hasAttribute('contenteditable')).toBe(true);
    el.textContent = 'Kısa';
    enter(el);
    expect(onCommit).toHaveBeenCalledWith('Kısa');
    stop();
  });

  it('yapıştırma yalnızca düz metin ekler', () => {
    const el = mk('');
    const stop = beginTextEdit(el, { max: 100, onCommit: () => {}, onCancel: () => {}, onCount: () => {} });
    const ev = new Event('paste', { bubbles: true, cancelable: true }) as unknown as ClipboardEvent;
    (ev as unknown as { clipboardData: unknown }).clipboardData = {
      getData: (t: string) => (t === 'text/plain' ? 'Düz\nmetin' : '<span style="x"><o:p>Word</o:p></span>'),
    };
    el.dispatchEvent(ev);
    expect(el.textContent).toBe('Düz metin');
    expect(el.children.length).toBe(0);
    stop();
  });

  it('onaydan ve vazgeçmeden sonra contenteditable ve etkin sınıf kalkar', () => {
    const el = mk('A');
    beginTextEdit(el, { max: 20, onCommit: () => {}, onCancel: () => {}, onCount: () => {} });
    expect(el.classList.contains('seker-edit-active')).toBe(true);
    enter(el);
    expect(el.hasAttribute('contenteditable')).toBe(false);
    expect(el.classList.contains('seker-edit-active')).toBe(false);
    beginTextEdit(el, { max: 20, onCommit: () => {}, onCancel: () => {}, onCount: () => {} });
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.hasAttribute('contenteditable')).toBe(false);
    expect(el.classList.contains('seker-edit-active')).toBe(false);
  });

  it('boş onay eski metni geri getirir', () => {
    const el = mk('Eski metin');
    const onCommit = vi.fn();
    beginTextEdit(el, { max: 20, onCommit, onCancel: () => {}, onCount: () => {} });
    el.textContent = '   ';
    enter(el);
    expect(onCommit).toHaveBeenCalledWith('');
    expect(el.textContent).toBe('Eski metin');
  });
  it('isteğe bağlı alanda boş onay alanı boşaltır, eski metin geri gelmez', () => {
    const el = mk('Eski metin');
    const onCommit = vi.fn();
    beginTextEdit(el, { max: 20, optional: true, onCommit, onCancel: () => {}, onCount: () => {} });
    el.textContent = '  ';
    enter(el);
    expect(onCommit).toHaveBeenCalledWith('');
    expect(el.textContent).toBe('');
  });
  it('zaten boş isteğe bağlı alan boş bırakılırsa değişiklik sayılmaz', () => {
    const el = mk('');
    const onCommit = vi.fn();
    const onUnchanged = vi.fn();
    beginTextEdit(el, { max: 20, optional: true, onCommit, onUnchanged, onCancel: () => {}, onCount: () => {} });
    enter(el);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onUnchanged).toHaveBeenCalled();
  });
  it('metin kısaltılabilir', () => {
    const el = mk('Uzun bir eski metin');
    const onCommit = vi.fn();
    beginTextEdit(el, { max: 20, onCommit, onCancel: () => {}, onCount: () => {} });
    el.textContent = 'Kısa';
    enter(el);
    expect(onCommit).toHaveBeenCalledWith('Kısa');
    expect(el.textContent).toBe('Kısa');
  });
});

describe('beginTextEdit belirteçli metin', () => {
  const fill = (s: string) => s.replaceAll('{yilSayisi}', '10');
  const mk = () => {
    const el = document.createElement('p');
    el.textContent = '10 yıllık deneyim';
    document.body.append(el);
    return el;
  };
  const enter = (el: HTMLElement) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

  it('düzenlerken ham metni (belirteçle) gösterir; değişmediyse işlem yapmaz ve dolu metni geri koyar', () => {
    const el = mk();
    const onCommit = vi.fn();
    const onUnchanged = vi.fn();
    beginTextEdit(el, { raw: '{yilSayisi} yıllık deneyim', fill, onCommit, onUnchanged, onCancel: () => {}, onCount: () => {} });
    expect(el.textContent).toBe('{yilSayisi} yıllık deneyim');
    enter(el);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onUnchanged).toHaveBeenCalled();
    expect(el.textContent).toBe('10 yıllık deneyim');
  });

  it('değişiklikte belirteç korunur ve DOM dolu metni gösterir', () => {
    const el = mk();
    const onCommit = vi.fn();
    beginTextEdit(el, { raw: '{yilSayisi} yıllık deneyim', fill, onCommit, onCancel: () => {}, onCount: () => {} });
    el.textContent = '{yilSayisi} yıllık güzel deneyim';
    enter(el);
    expect(onCommit).toHaveBeenCalledWith('{yilSayisi} yıllık güzel deneyim');
    expect(el.textContent).toBe('10 yıllık güzel deneyim');
  });

  it('Esc dolu metni geri koyar', () => {
    const el = mk();
    beginTextEdit(el, { raw: '{yilSayisi} yıllık deneyim', fill, onCommit: () => {}, onCancel: () => {}, onCount: () => {} });
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.textContent).toBe('10 yıllık deneyim');
  });

  it('belirteçsiz metinde de değişmeyen onay işlem sayılmaz', () => {
    const el = document.createElement('p');
    el.textContent = 'Merhaba';
    document.body.append(el);
    const onCommit = vi.fn();
    beginTextEdit(el, { onCommit, onCancel: () => {}, onCount: () => {} });
    enter(el);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
