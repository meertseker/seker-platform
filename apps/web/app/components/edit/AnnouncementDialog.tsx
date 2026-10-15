'use client';

import { useState, useTransition } from 'react';
import { EditorContent } from '@tiptap/react';
import {
  createAnnouncement,
  deleteAnnouncement,
  moveAnnouncement,
  updateAnnouncement,
  type AnnouncementInput,
} from '@/app/actions/announcements';
import type { AnnouncementRow, ImageValue } from '@/lib/content/types';
import { Drawer } from './Drawer';
import { RichToolbar, useRichEditor } from './RichEditor';
import { UploadDialog } from './UploadDialog';

const BODY_MAX = 5000;
const TITLE_MAX = 120;
const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
const fmt = (d: string) => d.split('-').reverse().join('.');

type Props = {
  announcements: AnnouncementRow[];
  /** Açılışta seçili duyuru; 'new' yeni duyuru formu. */
  initialId: string | 'new';
  onClose(): void;
};

export function AnnouncementDialog({ announcements, initialId, onClose }: Props) {
  const [selected, setSelected] = useState<string | 'new'>(initialId);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // İç içe fotoğraf penceresi açıkken Esc yalnızca onu kapatsın (Drawer'lar pencere düzeyinde dinler).
  const [nested, setNested] = useState(false);
  const current = selected === 'new' ? null : announcements.find((a) => a.id === selected) ?? null;

  function move(id: string, direction: -1 | 1) {
    setError(null);
    start(async () => {
      const r = await moveAnnouncement(id, direction);
      if (!r.ok) return setError(r.error);
      window.location.reload();
    });
  }

  return (
    <Drawer title="Duyurular" onClose={() => { if (!nested) onClose(); }}>
      <section aria-label="Tüm duyurular" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>Tüm duyurular ({announcements.length})</strong>
          <button type="button" onClick={() => { setError(null); setSelected('new'); }}>Yeni duyuru</button>
        </div>
        {announcements.length ? (
          <ol style={{ display: 'grid', gap: 6, padding: 0, margin: 0, listStyle: 'none' }}>
            {announcements.map((a, i) => (
              <li key={a.id} style={{ display: 'flex', gap: 6, alignItems: 'center', border: '1px solid #e2d7f0', borderRadius: 8, padding: '6px 8px', background: a.id === selected ? '#f3ecfb' : undefined }}>
                <button type="button" aria-current={a.id === selected} onClick={() => { setError(null); setSelected(a.id); }} style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{a.title}</span>
                  <small>{a.published ? 'Yayında' : 'Taslak'} · {fmt(a.startsOn)}{a.endsOn ? ` – ${fmt(a.endsOn)}` : ''}</small>
                </button>
                <button type="button" aria-label={`${a.title} duyurusunu yukarı taşı`} disabled={busy || i === 0} onClick={() => move(a.id, -1)}>Yukarı</button>
                <button type="button" aria-label={`${a.title} duyurusunu aşağı taşı`} disabled={busy || i === announcements.length - 1} onClick={() => move(a.id, 1)}>Aşağı</button>
              </li>
            ))}
          </ol>
        ) : (
          <p style={{ color: '#5f4f75' }}>Henüz duyuru yok.</p>
        )}
      </section>
      {selected === 'new' || current ? (
        <AnnouncementForm key={selected} row={current} onClose={onClose} outerError={error} onNested={setNested} />
      ) : (
        <p style={{ color: '#5f4f75' }}>Düzenlemek için listeden bir duyuru seçin.</p>
      )}
      {!(selected === 'new' || current) && error ? <p role="alert" style={{ color: '#b4234e' }}>{error}</p> : null}
    </Drawer>
  );
}

function AnnouncementForm({ row, onClose, outerError, onNested }: {
  row: AnnouncementRow | null; onClose(): void; outerError: string | null; onNested(open: boolean): void;
}) {
  const [title, setTitle] = useState(row?.title ?? '');
  const [startsOn, setStartsOn] = useState(row?.startsOn ?? today());
  const [endsOn, setEndsOn] = useState(row?.endsOn ?? '');
  const [published, setPublished] = useState(row?.published ?? true);
  const [image, setImage] = useState<{ id: string; src: string | null } | null>(row?.imageId ? { id: row.imageId, src: null } : null);
  const [uploading, setUploadingState] = useState(false);
  const setUploading = (open: boolean) => { setUploadingState(open); onNested(open); };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const { editor, count } = useRichEditor(row?.body ?? '');
  const over = count > BODY_MAX;

  function save() {
    setError(null);
    if (!editor) return;
    const input: AnnouncementInput = {
      title, body: editor.getHTML(), imageId: image?.id ?? null, startsOn, endsOn: endsOn || null, published,
    };
    start(async () => {
      const r = row ? await updateAnnouncement(row.id, input) : await createAnnouncement(input);
      if (!r.ok) return setError(r.error);
      window.location.reload();
    });
  }

  function remove() {
    if (!row) return;
    setError(null);
    start(async () => {
      const r = await deleteAnnouncement(row.id);
      if (!r.ok) {
        setConfirmDelete(false);
        return setError(r.error);
      }
      window.location.reload();
    });
  }

  const shownError = error ?? outerError;
  const noImage: ImageValue = { src: image?.src ?? BLANK_IMAGE, alt: '', width: 0, height: 0, assetId: image?.id ?? null };

  return (
    <>
    <form onSubmit={(e) => { e.preventDefault(); save(); }} aria-label={row ? 'Duyuruyu düzenle' : 'Yeni duyuru'} style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ font: '600 16px system-ui', margin: 0 }}>{row ? 'Duyuruyu düzenle' : 'Yeni duyuru'}</h3>
      <label style={{ display: 'grid', gap: 4 }}>
        Başlık <small>({[...title].length} / {TITLE_MAX})</small>
        <input id="seker-ann-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div>
        <span id="seker-ann-body-label">Metin</span>
        {editor ? (
          <>
            <RichToolbar editor={editor} />
            <EditorContent editor={editor} aria-labelledby="seker-ann-body-label" style={{ border: '1px solid #e2d7f0', borderRadius: 8, padding: 12, minHeight: 140 }} />
            <p aria-live="polite" style={{ fontSize: 13, color: over ? '#b4234e' : '#5f4f75', margin: '4px 0 0' }}>
              {count} / {BODY_MAX} karakter{over ? ' (sınır aşıldı)' : ''}
            </p>
          </>
        ) : null}
      </div>
      <div>
        <span>Fotoğraf (isteğe bağlı)</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          {image?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.src} alt="" style={{ width: 96, borderRadius: 8 }} />
          ) : null}
          <span>{image ? 'Fotoğraf seçili' : 'Fotoğraf yok'}</span>
          <button type="button" onClick={() => setUploading(true)}>{image ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}</button>
          {image ? <button type="button" onClick={() => setImage(null)}>Fotoğrafı kaldır</button> : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: 4 }}>
          Başlangıç
          <input id="seker-ann-starts" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          Bitiş (boşsa süresiz)
          <input id="seker-ann-ends" type="date" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </label>
      </div>
      <label style={{ display: 'flex', gap: 6 }}>
        <input id="seker-ann-published" type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Yayında
      </label>
      {shownError ? <p role="alert" style={{ color: '#b4234e', margin: 0 }}>{shownError}</p> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" disabled={busy || over || !editor}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
        {row && !confirmDelete ? <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>Sil</button> : null}
        {row && confirmDelete ? (
          <>
            <button type="button" disabled={busy} onClick={remove}>Silmeyi onayla</button>
            <button type="button" onClick={() => setConfirmDelete(false)}>Vazgeç</button>
          </>
        ) : null}
        <button type="button" onClick={onClose}>Kapat</button>
      </div>
      <p style={{ fontSize: 13, color: '#5f4f75', margin: 0 }}>
        Duyuru &quot;Kaydet&quot;e basınca hemen kaydedilir; sayfadaki diğer değişikliklerden bağımsızdır. Bitiş tarihi geçen duyuru en geç bir saat içinde ziyaretçiden kalkar.
      </p>
    </form>
    {uploading ? (
        <UploadDialog
          title="Duyuru fotoğrafı"
          current={noImage}
          onDone={(v) => { if (v.assetId) setImage({ id: v.assetId, src: v.src }); setUploading(false); }}
          onClose={() => setUploading(false)}
        />
      ) : null}
    </>
  );
}
