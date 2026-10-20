import { countChars } from '@/lib/content/chars';

export function plainTextFromPaste(e: Pick<ClipboardEvent, 'clipboardData'>): string {
  return (e.clipboardData?.getData('text/plain') ?? '').replace(/\s*[\r\n]+\s*/g, ' ');
}

export function beginTextEdit(
  el: HTMLElement,
  opts: {
    max?: number;
    /** Kayıtlı ham değer ({yilSayisi} gibi belirteçli); verilirse düzenleme sırasında bu gösterilir. */
    raw?: string;
    /** Ham metni sayfada görünen (belirteçleri doldurulmuş) metne çevirir. */
    fill?: (s: string) => string;
    /** Boş bırakılabilir alan: boş onay alanı boşaltır (eski metin geri gelmez). */
    optional?: boolean;
    onUnchanged?(): void;
    onCommit(text: string): void; onCancel(): void; onCount(n: number, max?: number): void; onReject?(max: number): void },
): () => void {
  const original = el.textContent ?? '';
  const rawOriginal = opts.raw ?? original;
  const show = (t: string) => (opts.fill ? opts.fill(t) : t);
  if (opts.raw !== undefined && opts.raw !== original) el.textContent = opts.raw;
  try {
    el.contentEditable = 'plaintext-only';
  } catch {
    el.contentEditable = 'true';
  }
  if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
  el.classList.add('seker-edit-active');
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);

  const count = () => opts.onCount(countChars(el.textContent ?? ''), opts.max);
  const multiline = (opts.max ?? 0) > 300;
  let done = false;

  const finish = (commit: boolean) => {
    if (done) return;
    if (commit) {
      const text = (el.textContent ?? '').trim();
      if (opts.max !== undefined && countChars(text) > opts.max) {
        opts.onReject?.(opts.max);
        return; // düzenleme modunda kal; sınırı aşan değer asla işlenmez
      }
      done = true;
      if (text === rawOriginal.trim()) {
        el.textContent = original;
        (opts.onUnchanged ?? opts.onCancel)();
      } else if (!text) {
        // Zorunlu alan boş kalamaz: eski metin geri gelir. İsteğe bağlı alan boş kalır.
        el.textContent = opts.optional ? '' : original;
        opts.onCommit(text);
      } else {
        el.textContent = show(text);
        opts.onCommit(text);
      }
    } else {
      done = true;
      el.textContent = original;
      opts.onCancel();
    }
    cleanup();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      finish(true);
    }
  };
  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = plainTextFromPaste(e);
    const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
    if (!ok) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const node = document.createTextNode(text);
        r.insertNode(node);
        r.setStartAfter(node);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      } else el.append(text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };
  const onBlur = () => finish(true);
  const cleanup = () => {
    el.removeEventListener('keydown', onKey);
    el.removeEventListener('paste', onPaste);
    el.removeEventListener('input', count);
    el.removeEventListener('blur', onBlur);
    el.removeAttribute('contenteditable');
    el.classList.remove('seker-edit-active');
  };

  el.addEventListener('keydown', onKey);
  el.addEventListener('paste', onPaste);
  el.addEventListener('input', count);
  el.addEventListener('blur', onBlur);
  count();
  return () => {
    done = true;
    cleanup();
  };
}
