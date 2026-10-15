'use client';

import './edit.css';
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Editor } from '@seker/auth/editor';
import { UploadDialog } from './UploadDialog';
import { AnnouncementDialog } from './AnnouncementDialog';
import type { AnnouncementRow, ImageValue, ListItem, ReaderData } from '@/lib/content/types';
import { saveContent } from '@/app/actions/content';
import { applyListField, loadPending, pendingReducer, savePending } from './pending';
import { beginTextEdit } from './TextEditing';
import { Toasts, type Toast } from './Toasts';
import { RichEditor } from './RichEditor';
import { ListPanel } from './ListPanel';
import { SettingsPanel, settingsKeysFor } from './SettingsPanel';
import { HistoryDrawer } from './HistoryDrawer';
import { PhonePreview } from './PhonePreview';
import { fillVars } from '@/lib/content/chars';
import { PAGE_IDS } from '@/lib/content/pageIds';

const storage = () => (typeof window === 'undefined' ? null : window.sessionStorage);

export type EditBarProps = { editor: Editor | null; data: ReaderData; announcements: AnnouncementRow[] };

/** Önizleme iframe'inde hiçbir durum/yan etki olmasın: durumlu kısım hiç monte edilmez. */
export default function EditBar(props: EditBarProps) {
  if (typeof window !== 'undefined' && window.self !== window.top) return null;
  return <EditBarInner {...props} />;
}

function EditBarInner({ editor, data, announcements }: EditBarProps) {
  const router = useRouter();
  const [pending, dispatch] = useReducer(pendingReducer, undefined, () => loadPending(storage()));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [counter, setCounter] = useState<{ n: number; max?: number; top: number; left: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState<null | 'rich' | 'list' | 'settings' | 'history' | 'upload' | 'announcement' | 'preview'>(null);
  const [target, setTarget] = useState<{ key: string; path?: string } | null>(null);
  const [annId, setAnnId] = useState<string | 'new'>('new');
  const stopRef = useRef<null | (() => void)>(null);
  const metaRef = useRef(data.meta);
  const varsRef = useRef(data.vars);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    if (!t.persistent) setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  const currentValue = useCallback((key: string) => (key in pending ? pending[key].value : data.values[key]), [pending, data]);

  const currentValueRef = useRef(currentValue);
  useLayoutEffect(() => {
    metaRef.current = data.meta;
    varsRef.current = data.vars;
    currentValueRef.current = currentValue;
  });

  const setValue = useCallback(
    (key: string, value: unknown, path?: string) => {
      const next = path ? applyListField(currentValue(key) as { id: string }[], path, value) : value;
      dispatch({ type: 'set', key, value: next, baseUpdatedAt: data.updatedAt[key] ?? null });
    },
    [currentValue, data],
  );

  useEffect(() => savePending(storage(), pending), [pending]);

  // Başkası araya girdiyse (taze veri farklı), kullanıcının değerini koruyup tabanı tazele.
  useEffect(() => {
    const bases: Record<string, string | null> = {};
    for (const [k, p] of Object.entries(pending)) {
      const fresh = data.updatedAt[k] ?? null;
      if (p.baseUpdatedAt !== fresh) bases[k] = fresh;
    }
    const keys = Object.keys(bases);
    if (!keys.length) return;
    dispatch({ type: 'rebase', bases });
    toast({
      text: `Bu metinleri siz düzenlerken başkası değiştirdi: ${keys.map((k) => data.meta[k]?.label ?? k).join(', ')}. Kaydederseniz sizin metniniz geçerli olur; istemiyorsanız Vazgeç'e basın.`,
      tone: 'error',
      persistent: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bekleyen değerleri sayfaya yansıt (yenilemeden sonra da görünsünler).
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-edit-key]').forEach((el) => {
      const key = el.dataset.editKey!;
      const path = el.dataset.editPath;
      const isPending = key in pending;
      el.dataset.editPending = isPending ? '1' : '0';
      if (isPending && el.dataset.editKind === 'image') {
        const v = pending[key].value;
        const item = path ? (v as Record<string, unknown>[]).find((i) => i.id === path.split('.')[0]) : null;
        const img = (path ? item?.[path.split('.')[1]] : v) as { src?: string } | undefined;
        const tag = el instanceof HTMLImageElement ? el : el.querySelector('img');
        if (tag && img?.src) {
          tag.src = img.src;
          tag.removeAttribute('srcset');
        }
        return;
      }
      if (!isPending || el.dataset.editKind !== 'text' || el.isContentEditable) return;
      const v = pending[key].value;
      if (path) {
        const [id, field] = path.split('.');
        const item = (v as Record<string, unknown>[]).find((i) => i.id === id);
        if (item && typeof item[field] === 'string') el.textContent = fillVars(item[field] as string, varsRef.current);
      } else if (typeof v === 'string') el.textContent = fillVars(v, varsRef.current);
    });
  }, [pending]);

  useEffect(() => {
    if (!editor || inIframe) return;
    document.body.classList.add('seker-editing');
    const onDbl = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-edit-announcement]');
      if (card) {
        e.preventDefault();
        setAnnId(card.dataset.editAnnouncement!);
        return setPanel('announcement');
      }
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-edit-key]');
      if (!el) return;
      e.preventDefault();
      const key = el.dataset.editKey!;
      const path = el.dataset.editPath;
      const kind = el.dataset.editKind;
      const warn = metaRef.current[key]?.warn;
      if (warn) toast({ text: warn, tone: 'warn' });
      if (kind === 'image') return void (setTarget({ key, path }), setPanel('upload'));
      if (kind === 'rich') return void (setTarget({ key, path }), setPanel('rich'));
      if (kind !== 'text') return;
      stopRef.current?.();
      const max = el.dataset.editMax ? Number(el.dataset.editMax) : undefined;
      const rect = el.getBoundingClientRect();
      const cur = currentValueRef.current(key);
      const rawVal = path
        ? (() => {
            const [id, field] = path.split('.');
            return (cur as Record<string, unknown>[] | undefined)?.find((i) => i.id === id)?.[field];
          })()
        : cur;
      stopRef.current = beginTextEdit(el, {
        max,
        raw: typeof rawVal === 'string' ? rawVal : undefined,
        fill: (t) => fillVars(t, varsRef.current),
        onUnchanged: () => {
          setCounter(null);
          stopRef.current = null;
          toast({ text: 'Değişiklik yok.', tone: 'warn' });
        },
        onCount: (n, m) => setCounter({ n, max: m, top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX }),
        onCommit: (text) => {
          setCounter(null);
          stopRef.current = null;
          if (!text) return toast({ text: 'Boş bırakılamaz; eski metin geri getirildi.', tone: 'error' });
          setValue(key, text, path);
        },
        onReject: (m) => toast({ text: `Bu alan en fazla ${m} karakter olabilir.`, tone: 'error' }),
        onCancel: () => {
          setCounter(null);
          stopRef.current = null;
        },
      });
    };
    const onClick = (e: MouseEvent) => {
      // Düzenleme modunda bağlantılar çift tıklamayı bozmasın.
      if ((e.target as HTMLElement).closest('[data-edit-key], [data-edit-announcement]') && (e.target as HTMLElement).closest('a')) e.preventDefault();
    };
    document.addEventListener('dblclick', onDbl);
    document.addEventListener('click', onClick, true);
    return () => {
      document.body.classList.remove('seker-editing');
      document.removeEventListener('dblclick', onDbl);
      document.removeEventListener('click', onClick, true);
      stopRef.current?.();
    };
  }, [editor, inIframe, setValue, toast]);

  const count = Object.keys(pending).length;
  useEffect(() => {
    if (!count) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [count]);

  /** Depoyu eşzamanlı temizler: effect render sonrasına kalır, hemen yenilenirse bekleyenler geri gelirdi. */
  function clearPending() {
    savePending(storage(), {});
    dispatch({ type: 'clear' });
  }

  async function save() {
    setSaving(true);
    let res: Awaited<ReturnType<typeof saveContent>>;
    try {
      res = await saveContent(
        Object.entries(pending).map(([key, p]) => ({ key, value: p.value, baseUpdatedAt: p.baseUpdatedAt })),
      );
    } catch {
      toast({ text: 'Kaydedilemedi, tekrar deneyin.', tone: 'error' });
      return;
    } finally {
      setSaving(false);
    }
    if (res.ok) {
      clearPending();
      toast({ text: 'Yayında. Ziyaretçiler yeni hâlini görüyor.', tone: 'ok' });
      router.refresh();
      return;
    }
    const labels = res.conflicts?.map((k) => data.meta[k]?.label ?? k).join(', ');
    toast({
      text: labels ? `${res.error} (${labels})` : res.error,
      tone: 'error',
      ...(res.error.startsWith('Oturumunuz') ? { href: `${process.env.NEXT_PUBLIC_PANEL_URL ?? ''}/login`, hrefLabel: 'Panele git' } : {}),
    });
  }

  function discard() {
    clearPending();
    window.location.reload();
  }

  if (inIframe) return null;

  if (!editor) {
    return (
      <div className="seker-editbar" role="region" aria-label="Düzenleme çubuğu">
        <span>Oturumunuz sona erdi. Düzenlemek için panelden tekrar giriş yapın.</span>
        <a href={`${process.env.NEXT_PUBLIC_PANEL_URL ?? ''}/login`}>Panele git</a>
        <form method="GET" action="/api/edit/disable"><button type="submit">Düzenlemeden çık</button></form>
      </div>
    );
  }

  return (
    <>
      <div className="seker-editbar" role="region" aria-label="Düzenleme çubuğu">
        <span>✎ Düzenleme modu</span>
        <span aria-live="polite">{count ? `${count} kaydedilmemiş değişiklik` : 'Değişiklik yok'}</span>
        <span style={{ flex: 1 }} />
        <EditBarExtras
          data={data}
          pending={pending}
          announcements={announcements}
          annId={annId}
          setAnnId={setAnnId}
          panel={panel}
          setPanel={setPanel}
          target={target}
          setTarget={setTarget}
          setValue={setValue}
          currentValue={currentValue}
          toast={toast}
        />
        <button type="button" onClick={discard} disabled={!count || saving}>Vazgeç</button>
        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={!count || saving || (counter?.max !== undefined && counter.n > counter.max)}
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <form method="GET" action="/api/edit/disable">
          <input type="hidden" name="next" value={typeof window !== 'undefined' ? window.location.pathname : '/'} />
          <button type="submit" disabled={count > 0} title={count ? 'Önce kaydedin veya vazgeçin' : undefined}>Çık</button>
        </form>
      </div>
      {counter ? (
        <div
          className={`seker-counter ${counter.max && counter.n > counter.max ? 'over' : ''}`}
          style={{ top: counter.top, left: counter.left }}
        >
          {counter.max ? `${counter.n} / ${counter.max}` : counter.n}
        </div>
      ) : null}
      <Toasts items={toasts} />
    </>
  );
}

type ExtrasProps = {
  data: ReaderData;
  pending: Record<string, unknown>;
  announcements: AnnouncementRow[];
  annId: string | 'new';
  setAnnId(id: string | 'new'): void;
  panel: string | null;
  setPanel(p: null | 'rich' | 'list' | 'settings' | 'history' | 'upload' | 'announcement' | 'preview'): void;
  target: { key: string; path?: string } | null;
  setTarget(t: { key: string; path?: string } | null): void;
  setValue(key: string, value: unknown, path?: string): void;
  currentValue(key: string): unknown;
  toast(t: Omit<Toast, 'id'>): void;
};

/** Task 10 ve 18 yükleme ve duyuru panellerini buraya ekler. */
function EditBarExtras(p: ExtrasProps) {
  const [lists, setLists] = useState<{ key: string; label: string }[]>([]);
  useEffect(() => {
    const seen = new Map<string, string>();
    document.querySelectorAll<HTMLElement>('[data-edit-list]').forEach((el) => seen.set(el.dataset.editList!, el.dataset.editLabel ?? el.dataset.editList!));
    setLists([...seen].map(([key, label]) => ({ key, label })));
  }, []);
  const richInitial = () => {
    if (!p.target) return '';
    const v = p.currentValue(p.target.key);
    if (!p.target.path) return String(v);
    const [id, field] = p.target.path.split('.');
    return String((v as ListItem[]).find((i) => i.id === id)?.[field] ?? '');
  };
  const richMeta = p.target ? p.data.meta[p.target.key] : undefined;
  return (
    <>
      {lists.length ? (
        <select id="seker-list-select" aria-label="Bu sayfadaki listeler" value="" onChange={(e) => { if (!e.target.value) return; p.setTarget({ key: e.target.value }); p.setPanel('list'); }}>
          <option value="">Listeler…</option>
          {lists.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
        </select>
      ) : null}
      {window.location.pathname.startsWith('/bultenler') ? (
        <button type="button" onClick={() => { p.setAnnId('new'); p.setPanel('announcement'); }}>Yeni duyuru</button>
      ) : null}
      <button type="button" onClick={() => p.setPanel('settings')}>Sayfa ayarları</button>
      <button type="button" onClick={() => p.setPanel('preview')}>Telefon görünümü</button>
      <button type="button" onClick={() => p.setPanel('history')}>Geçmiş</button>
      {p.panel === 'rich' && p.target && richMeta ? (
        <RichEditor
          title={richMeta.label}
          initial={richInitial()}
          max={p.target.path ? richMeta.fields?.[p.target.path.split('.')[1]]?.max : richMeta.max}
          allowHeadings={richMeta.allowHeadings}
          onDone={(html) => { p.setValue(p.target!.key, html, p.target!.path); p.setPanel(null); }}
          onClose={() => p.setPanel(null)}
        />
      ) : null}
      {p.panel === 'list' && p.target ? (
        <ListPanel listKey={p.target.key} meta={p.data.meta[p.target.key]} value={p.currentValue(p.target.key) as ListItem[]}
          onChange={(next) => p.setValue(p.target!.key, next)} onClose={() => p.setPanel(null)} />
      ) : null}
      {p.panel === 'settings' ? (
        <SettingsPanel keys={settingsKeysFor(window.location.pathname, p.data.meta, PAGE_IDS)} data={p.data}
          currentValue={p.currentValue} onChange={(k, v) => p.setValue(k, v)} onClose={() => p.setPanel(null)} />
      ) : null}
      {p.panel === 'history' ? (
        <HistoryDrawer onClose={() => p.setPanel(null)}
          onReverted={() => { p.toast({ text: 'Geri alındı ve yayında.', tone: 'ok' }); window.location.reload(); }}
          onError={(text) => p.toast({ text, tone: 'error' })} />
      ) : null}
      {p.panel === 'upload' && p.target ? (
        <UploadDialog
          title={p.data.meta[p.target.key].label}
          current={(p.target.path
            ? (p.currentValue(p.target.key) as ListItem[]).find((i) => i.id === p.target!.path!.split('.')[0])?.[p.target.path.split('.')[1]]
            : p.currentValue(p.target.key)) as ImageValue}
          onDone={(v) => { p.setValue(p.target!.key, v, p.target!.path); p.setPanel(null); p.toast({ text: 'Fotoğraf hazır. Yayınlamak için Kaydet’e basın.', tone: 'ok' }); }}
          onClose={() => p.setPanel(null)}
        />
      ) : null}
      {p.panel === 'announcement' ? (
        <AnnouncementDialog announcements={p.announcements} initialId={p.annId} onClose={() => p.setPanel(null)} />
      ) : null}
      {p.panel === 'preview' ? <PhonePreview onClose={() => p.setPanel(null)} /> : null}
    </>
  );
}
