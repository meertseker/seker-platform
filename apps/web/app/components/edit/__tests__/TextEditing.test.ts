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
