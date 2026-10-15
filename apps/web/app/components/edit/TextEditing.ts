import { countChars } from '@/lib/content/chars';

export function plainTextFromPaste(e: Pick<ClipboardEvent, 'clipboardData'>): string {
  return (e.clipboardData?.getData('text/plain') ?? '').replace(/\s*[\r\n]+\s*/g, ' ');
}

export function beginTextEdit(
  el: HTMLElement,
  opts: { max?: number; onCommit(text: string): void; onCancel(): void; onCount(n: number, max?: number): void },
): () => void {
  const original = el.textContent ?? '';
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
    done = true;
    if (commit) opts.onCommit((el.textContent ?? '').trim());
    else {
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
    document.execCommand('insertText', false, plainTextFromPaste(e));
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
