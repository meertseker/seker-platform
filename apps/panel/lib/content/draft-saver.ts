// Görevim ekranının taslak kaydedicisi: görev başına bir tane, sekme değişse de yaşar.
// Kayıtlar sırayla gider (üst üste binmez); teslimden önce flush süren kaydı bekler.
import { OFFLINE_SAVE_MESSAGE, mergePatch, type TextPatch } from "./task-flow";

export type DraftPatch = TextPatch & { faceAnswer?: boolean | null };
export type SaveResult = { ok: true } | { ok: false; error: string };
export type SaveState = { state: "idle" | "saving" | "saved" | "error"; error: string | null };

type SaveFn = (patch: DraftPatch) => Promise<{ ok: true } | { error: string }>;

export interface DraftSaver {
  /** Değişikliği sıraya koyar; kısa bir beklemeden sonra kaydedilir. */
  queue(patch: DraftPatch): void;
  /** Süren kaydı bekler, sonra bekleyeni kaydeder. Biri başarısızsa onun mesajı döner. */
  flush(): Promise<SaveResult>;
  /** Kaydedilemeyen değişiklik varsa hemen yeniden dener (bağlantı geldiğinde). */
  retry(): void;
  /** Bekleyen bir alanı sıradan çıkarır (yeni video gelince eski yüz cevabı gönderilmez). */
  drop(key: keyof DraftPatch): void;
  hasUnsaved(): boolean;
}

const isEmpty = (p: DraftPatch) => Object.keys(p).length === 0;

export function createDraftSaver(opts: {
  save: SaveFn;
  delayMs: number;
  onState: (s: SaveState) => void;
}): DraftSaver {
  let pending: DraftPatch = {};
  let inFlight: Promise<SaveResult> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  async function send(): Promise<SaveResult> {
    const patch = pending;
    pending = {};
    opts.onState({ state: "saving", error: null });
    let res: SaveResult;
    try {
      const r = await opts.save(patch);
      res = "error" in r ? { ok: false, error: r.error } : { ok: true };
    } catch {
      res = { ok: false, error: OFFLINE_SAVE_MESSAGE };
    }
    if (!res.ok) {
      // Kaydedilemeyen değişiklik geri konur; arada yazılan daha yeni değer üstün gelir.
      pending = mergePatch(patch, pending);
      opts.onState({ state: "error", error: res.error });
    } else {
      opts.onState(isEmpty(pending) ? { state: "saved", error: null } : { state: "idle", error: null });
    }
    return res;
  }

  /** Kayıtlar zincirlenir: bir önceki bitmeden yenisi gitmez. */
  function run(): Promise<SaveResult> {
    const prev = inFlight;
    const p: Promise<SaveResult> = (async () => {
      if (prev) await prev;
      return isEmpty(pending) ? ({ ok: true } as const) : send();
    })();
    inFlight = p;
    void p.finally(() => {
      if (inFlight === p) inFlight = null;
    });
    return p;
  }

  return {
    queue(patch) {
      pending = { ...pending, ...patch };
      opts.onState({ state: "idle", error: null });
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, opts.delayMs);
    },
    async flush() {
      clearTimer();
      if (inFlight) {
        const r = await inFlight;
        if (!r.ok) return r;
      }
      return run();
    },
    retry() {
      if (isEmpty(pending) || inFlight) return;
      clearTimer();
      void run();
    },
    drop(key) {
      const rest = { ...pending };
      delete rest[key];
      pending = rest;
    },
    hasUnsaved() {
      return !isEmpty(pending) || inFlight !== null;
    },
  };
}
