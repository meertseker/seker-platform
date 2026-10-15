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
});
