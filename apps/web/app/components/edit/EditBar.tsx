'use client';

import './edit.css';
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Editor } from '@seker/auth/editor';
import { UploadDialog } from './UploadDialog';
import { AnnouncementDialog } from './AnnouncementDialog';
import type { AnnouncementRow, ImageValue, ListItem, ReaderData } from '@/lib/content/types';
import { saveContent } from '@/app/actions/content';
import { applyListField, loadPending, pendingReducer, savePending, type Pending } from './pending';
import {
  clearResume,
  draftKey,
  listDrafts,
  purgeDrafts,
  readResume,
  removeDraft,
  RESUME_MAX_ATTEMPTS,
  writeDraft,
  writeResume,
  type Draft,
} from './drafts';
import { classifySaveError } from './saveErrors';
import { beginTextEdit } from './TextEditing';
import { Toasts, type Toast } from './Toasts';
import { RichEditor } from './RichEditor';
import { ListPanel } from './ListPanel';
import { SettingsPanel, settingsKeysFor } from './SettingsPanel';
import { HistoryDrawer } from './HistoryDrawer';
import { PhonePreview } from './PhonePreview';
import { fillVars } from '@/lib/content/chars';
import { PAGE_IDS } from '@/lib/content/pageIds';

/** Sekmenin çalışma kopyası. */
const storage = () => (typeof window === 'undefined' ? null : window.sessionStorage);
/** Sekme kapansa da kalan yedek (drafts.ts). Gizli sekmede erişim fırlatabilir. */
const local = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** "Site güncellendi" mesajı okunabilsin diye yenilemeden önceki bekleme. */
export const RELOAD_DELAY_MS = 1500;
/** Bekleyen değişiklik bu süreden uzun kaydedilmezse çubukta hatırlatma çıkar. */
export const REMIND_AFTER_MS = 5 * 60 * 1000;

const VERSION_TEXT = 'Site güncellendi. Değişiklikleriniz korunarak sayfa yenileniyor…';

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
  // Bu sekmede bekleyen yoksa, kapanmış sekmelerden kalan taslaklar sorulur (bileşen yalnızca istemcide çizilir).
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    editor && !Object.keys(loadPending(storage())).length
      ? listDrafts(local(), editor.id, Date.now(), window.location.pathname)
      : [],
  );
  const [reloading, setReloading] = useState(false);
  const [remind, setRemind] = useState(false);
  const editorId = editor?.id ?? null;
  /** Bu sekmenin localStorage'a yazdığı taslağın sayfası; başka sekmelerin taslaklarına dokunulmaz. */
  const draftPathRef = useRef<string | null>(null);
  /** Kendi başlattığımız yenilemede "sayfadan ayrıl?" sorusu çıkmasın. */
  const allowUnloadRef = useRef(false);
  const startedRef = useRef(false);
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

  // Tek kaynak reducer durumu; sessionStorage çalışma kopyası, localStorage (kullanıcı + sayfa) yedeği.
  useEffect(() => {
    savePending(storage(), pending);
    if (!editorId) return;
    const path = window.location.pathname;
    const owned = draftPathRef.current;
    if (!Object.keys(pending).length) {
      // Yalnızca bu sekmenin yazdığı taslak silinir; kapanmış bir sekmenin taslağı soru bekliyor olabilir.
      if (owned) removeDraft(local(), draftKey(editorId, owned));
      draftPathRef.current = null;
      return;
    }
    if (owned && owned !== path) removeDraft(local(), draftKey(editorId, owned));
    writeDraft(local(), editorId, path, pending, Date.now());
    draftPathRef.current = path;
  }, [pending, editorId]);

  /**
   * Başkası araya girdiyse (taze veri farklı), kullanıcının değerini koruyup tabanı tazeler ve uyarır.
   * Tazelenen anahtarları döndürür.
   */
  const rebaseAgainstServer = useCallback(
    (p: Pending): string[] => {
      const bases: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(p)) {
        const fresh = data.updatedAt[k] ?? null;
        if (v.baseUpdatedAt !== fresh) bases[k] = fresh;
      }
      const keys = Object.keys(bases);
      if (!keys.length) return keys;
      dispatch({ type: 'rebase', bases });
      toast({
        text: `Bu metinleri siz düzenlerken başkası değiştirdi: ${keys.map((k) => data.meta[k]?.label ?? k).join(', ')}. Kaydederseniz sizin metniniz geçerli olur; istemiyorsanız Vazgeç'e basın.`,
        tone: 'error',
        persistent: true,
      });
      return keys;
    },
    [data, toast],
  );

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
      const optional = el.dataset.editOptional === '1';
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
        optional,
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
          if (!text && !optional) return toast({ text: 'Bu alan boş bırakılamaz; eski metin geri getirildi.', tone: 'error' });
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
      if (allowUnloadRef.current) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [count]);

  // Bekleyen değişiklik REMIND_AFTER_MS boyunca kaydedilmezse nazik hatırlatma; sayaç ilk değişiklikte başlar.
  const hasPending = count > 0;
  useEffect(() => {
    if (!hasPending) return;
    const t = setTimeout(() => setRemind(true), REMIND_AFTER_MS);
    return () => {
      clearTimeout(t);
      setRemind(false);
    };
  }, [hasPending]);

  /** Depoyu eşzamanlı temizler: effect render sonrasına kalır, hemen yenilenirse bekleyenler geri gelirdi. */
  function clearPending() {
    savePending(storage(), {});
    if (editorId) {
      removeDraft(local(), draftKey(editorId, window.location.pathname));
      if (draftPathRef.current) removeDraft(local(), draftKey(editorId, draftPathRef.current));
    }
    draftPathRef.current = null;
    dispatch({ type: 'clear' });
  }

  /**
   * Sekme eski bir derlemeden kalmış (sunucu eylemi bulunamadı) ya da istek sunucuya ulaşmadı (deploy
   * sırasında konteyner yeniden başlıyor). Bekleyenler eşzamanlı saklanır, sayfa yenilenir; yeni sayfa
   * işareti görünce bekleyenleri geri yükler ve mümkünse kendiliğinden kaydeder.
   */
  function recoverFromStale(kind: 'version' | 'network') {
    const now = Date.now();
    if (kind === 'network' && typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast({ text: "İnternet bağlantısı yok. Değişiklikleriniz bu tarayıcıda saklandı; bağlantı gelince Kaydet'e tekrar basın.", tone: 'error' });
      return;
    }
    const prev = readResume(storage(), now);
    if (prev && prev.attempts >= RESUME_MAX_ATTEMPTS) {
      // Yenileme sorunu çözmedi: döngüye girme, kullanıcıya bırak.
      clearResume(storage());
      toast({
        text: "Sunucuya şu an ulaşılamıyor. Değişiklikleriniz bu tarayıcıda saklandı; birkaç dakika sonra Kaydet'e tekrar basın.",
        tone: 'error',
        persistent: true,
      });
      return;
    }
    savePending(storage(), pending);
    if (editorId) {
      const path = window.location.pathname;
      writeDraft(local(), editorId, path, pending, now);
      draftPathRef.current = path;
    }
    writeResume(storage(), { at: now, attempts: (prev?.attempts ?? 0) + 1 });
    allowUnloadRef.current = true;
    setReloading(true);
    toast({ text: VERSION_TEXT, tone: 'warn', persistent: true });
    setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
  }

  async function save() {
    setSaving(true);
    let res: Awaited<ReturnType<typeof saveContent>>;
    try {
      res = await saveContent(
        Object.entries(pending).map(([key, p]) => ({ key, value: p.value, baseUpdatedAt: p.baseUpdatedAt })),
      );
    } catch (err) {
      const kind = classifySaveError(err);
      if (kind !== 'other') return recoverFromStale(kind);
      clearResume(storage());
      toast({ text: 'Kaydedilemedi, tekrar deneyin.', tone: 'error' });
      return;
    } finally {
      setSaving(false);
    }
    // Sunucu yanıt verdi: sürüm sorunu yok, yenileme sayacı sıfırlanır.
    clearResume(storage());
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
    allowUnloadRef.current = true;
    window.location.reload();
  }

  function restoreDraft(d: Draft) {
    // Bu sekmede o sırada yapılmış değişiklikler üstün gelir (merge); geri kalanların tabanı denetlenir.
    const restored = Object.fromEntries(Object.entries(d.pending).filter(([k]) => !(k in pending)));
    dispatch({ type: 'merge', pending: d.pending });
    removeDraft(local(), d.key);
    setDrafts([]);
    const rebased = rebaseAgainstServer(restored);
    if (!rebased.length) {
      toast({ text: `${Object.keys(restored).length} değişiklik geri yüklendi. Yayınlamak için Kaydet'e basın.`, tone: 'ok' });
    }
  }

  function dropDraft(d: Draft) {
    removeDraft(local(), d.key);
    setDrafts((ds) => ds.filter((x) => x.key !== d.key));
  }

  // Açılış: bayat tabanları tazele, eski taslakları temizle/sor, sürüm yenilemesinden döndüysek devam et.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const now = Date.now();
    const initial = pending;
    const rebased = rebaseAgainstServer(initial);
    const hasInitial = Object.keys(initial).length > 0;
    purgeDrafts(local(), now);
    const resume = readResume(storage(), now);
    if (!resume || !hasInitial) {
      clearResume(storage());
      return;
    }
    // Bildirim ve kayıt ilk çizimden sonraya bırakılır (effect içinde eşzamanlı setState yok).
    queueMicrotask(() => {
      if (editorId && !rebased.length) {
        // Tabanlar değişmedi: kullanıcının bastığı Kaydet tamamlanır; sunucu yine baseUpdatedAt ile çakışma denetler.
        toast({ text: 'Site güncellendi. Değişiklikleriniz geri yüklendi, kaydediliyor…', tone: 'ok' });
        void save();
        return;
      }
      clearResume(storage());
      toast({
        text: "Site güncellendi. Değişiklikleriniz geri yüklendi; yayınlamak için Kaydet'e tekrar basın.",
        tone: 'warn',
        persistent: true,
      });
    });
    // Yalnızca açılışta bir kez çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draft = drafts[0];

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
        {remind && count ? <span className="seker-remind" role="status">Kaydetmeyi unutmayın</span> : null}
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
        <button type="button" onClick={discard} disabled={!count || saving || reloading}>Vazgeç</button>
        <button
          type="button"
          className={remind && count ? 'primary remind' : 'primary'}
          onClick={save}
          disabled={!count || saving || reloading || (counter?.max !== undefined && counter.n > counter.max)}
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <form method="GET" action="/api/edit/disable">
          <input type="hidden" name="next" value={typeof window !== 'undefined' ? window.location.pathname : '/'} />
          <button type="submit" disabled={count > 0} title={count ? 'Önce kaydedin veya vazgeçin' : undefined}>Çık</button>
        </form>
      </div>
      {draft ? (
        <div className="seker-restore" role="dialog" aria-label="Kaydedilmemiş değişiklikler">
          <span>
            Kaydedilmemiş {Object.keys(draft.pending).length} değişiklik bulundu
            {' '}({new Date(draft.savedAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            {draft.path !== (typeof window !== 'undefined' ? window.location.pathname : draft.path) ? `, ${draft.path} sayfasında` : ''}).
          </span>
          <button type="button" className="primary" onClick={() => restoreDraft(draft)}>Geri yükle</button>
          <button type="button" onClick={() => dropDraft(draft)}>At</button>
        </div>
      ) : null}
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
      {window.location.pathname === '/' ? (
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
