'use client';

import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { countChars } from '@/lib/content/chars';
import { richToText } from '@/lib/content/sanitize';
import { Drawer } from './Drawer';

export function RichEditor({ title, initial, max, allowHeadings, onDone, onClose }: {
  title: string;
  initial: string;
  max?: number;
  allowHeadings?: boolean;
  onDone(html: string): void;
  onClose(): void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: allowHeadings ? { levels: [2] } : false,
        codeBlock: false, code: false, blockquote: false, horizontalRule: false, strike: false, underline: false,
        link: { openOnClick: false, autolink: true, protocols: ['mailto', 'tel'] },
      }),
    ],
    content: initial,
  });
  // Sunucuyla aynı kural: richToText + countChars.
  const rawCount = useEditorState({
    editor,
    selector: (s) => (s.editor ? countChars(richToText(s.editor.getHTML())) : 0),
  });
  const count = rawCount ?? 0;
  if (!editor) return null;
  const over = max !== undefined && count > max;
  const btn = (label: string, run: () => void, active: boolean) => (
    <button type="button" aria-pressed={active} onClick={run} style={{ fontWeight: active ? 700 : 400 }}>{label}</button>
  );
  return (
    <Drawer title={title} onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {btn('Kalın', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {btn('İtalik', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {allowHeadings ? btn('Başlık', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading')) : null}
        {btn('Madde işaretli', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('Numaralı', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        {btn('Bağlantı', () => {
          const url = (document.getElementById('seker-link-input') as HTMLInputElement | null)?.value.trim() ?? '';
          if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          else editor.chain().focus().unsetLink().run();
        }, editor.isActive('link'))}
        <input id="seker-link-input" placeholder="https://… veya tel:…" aria-label="Bağlantı adresi" style={{ flex: 1, minWidth: 160 }} />
      </div>
      <EditorContent editor={editor} style={{ border: '1px solid #e2d7f0', borderRadius: 8, padding: 12, minHeight: 200 }} />
      <p aria-live="polite" style={{ fontSize: 13, color: over ? '#b4234e' : '#5f4f75' }}>
        {max !== undefined ? `${count} / ${max}` : count} karakter{over ? ' (sınır aşıldı)' : ''}
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" disabled={over} onClick={() => onDone(editor.getHTML())}>Tamam</button>
        <button type="button" onClick={onClose}>Vazgeç</button>
      </div>
      <p style={{ fontSize: 13, color: '#5f4f75' }}>Yapıştırılan metnin biçimi sadeleştirilir; yalnızca kalın, italik, liste ve bağlantı kalır. Değişiklik &quot;Kaydet&quot;e basınca yayınlanır.</p>
    </Drawer>
  );
}
