"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Film } from "lucide-react";
import { ContentCardDetail, OrganicNumbers, TONE_BAR, TONE_TEXT } from "@/components/content-card-detail";
import { ContentTaskNew } from "@/components/content-task-new";
import {
  cardLine,
  cardProgress,
  cardTag,
  emptyPerf,
  groupByStage,
  type BoardItem,
  type ContentPerf,
} from "@/lib/content/board";
import type { OrganicInfo } from "@/lib/content/organic";
import type { AdRules } from "@/lib/content/settings";
import type { ReelPanelContext } from "@/lib/content/reel-review";

interface Props {
  items: BoardItem[];
  perf: Record<string, ContentPerf>;
  perfError: boolean;
  rules: AdRules;
  teachers: { id: string; name: string }[];
  videoUrls: Record<string, string>;
  initialCode: string | null;
  nowIso: string;
  /** Organik aşamadaki Reels'lerin Instagram sayıları; kart kimliğine göre. */
  organic?: Record<string, OrganicInfo>;
  /** Instagram'a yayın bağlamı (Paket B); Reels yoksa null. */
  reel?: ReelPanelContext | null;
}

/** Önce ?kod=, yoksa onay bekleyen ilk kart, o da yoksa ilk kart. */
function initialSelection(items: BoardItem[], code: string | null): string | null {
  if (code && items.some((i) => i.code === code)) return code;
  return items.find((i) => i.stage === "kontrol")?.code ?? items[0]?.code ?? null;
}

export function ContentBoard({ items, perf, perfError, rules, teachers, videoUrls, initialCode, nowIso, organic = {}, reel = null }: Props) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const columns = useMemo(() => groupByStage(items), [items]);
  const [selected, setSelected] = useState<string | null>(() => initialSelection(items, initialCode));
  const item = items.find((i) => i.code === selected) ?? null;
  const perfOf = (code: string) => perf[code] ?? emptyPerf();

  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusDetail = useRef(false);

  // Telefonda ayrıntı panosu kartların altında kalır: seçimden sonra başlığına odaklanıp oraya kaydırılır.
  useEffect(() => {
    if (!focusDetail.current || !item) return;
    focusDetail.current = false;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected, item]);

  function select(code: string) {
    focusDetail.current = true;
    setSelected(code);
    // Adres çubuğu da güncellenir; sunucu yeniden çalışmaz (bağlantı paylaşılabilir).
    window.history.replaceState(null, "", `?kod=${encodeURIComponent(code)}`);
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted-foreground">Her Reels ve sayfa bir kart. Kart soldan sağa ilerler.</p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">İçerik panosu</h1>
        </div>
        <ContentTaskNew teachers={teachers} onCreated={select} />
      </div>

      {perfError ? (
        <p role="alert" className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
          Reklam sayıları şu an okunamadı; kurallar sıfır sayıyla gösteriliyor. Sayfayı biraz sonra yenileyin.
        </p>
      ) : null}

      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[1250px] grid-cols-[repeat(6,minmax(200px,1fr))] gap-2.5">
          {columns.map((col) => (
            <section
              key={col.key}
              aria-label={col.title}
              className="flex min-h-[26rem] flex-col gap-2 rounded-2xl bg-muted p-2.5"
            >
              <div className="flex flex-col gap-0.5 px-1 pb-1 pt-0.5">
                <div className="flex justify-between text-sm font-bold text-foreground">
                  <span>{col.title}</span>
                  <span className="text-muted-foreground">{col.items.length}</span>
                </div>
                <span className="text-xs leading-snug text-muted-foreground">{col.hint}</span>
              </div>
              {col.items.map((i) => {
                const p = perfOf(i.code);
                const tag = cardTag(i, p, rules, now, organic[i.id]?.lead ?? undefined);
                const on = i.code === selected;
                const isGoogle = i.platform === "google";
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => select(i.code)}
                    aria-pressed={on}
                    className={`flex cursor-pointer flex-col gap-1.5 rounded-xl border-2 bg-surface p-2.5 text-left text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      on ? "border-primary" : "border-transparent hover:border-border"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`flex h-9 w-7 shrink-0 items-center justify-center rounded-md ${
                          isGoogle ? "bg-google-soft text-google" : "bg-instagram-soft text-instagram"
                        }`}
                      >
                        {i.kind === "reels" ? <Film size={14} /> : <FileText size={14} />}
                      </span>
                      <span className="flex min-w-0 flex-col gap-px">
                        <span className={`text-[11.5px] font-bold ${isGoogle ? "text-google" : "text-instagram"}`}>
                          {i.code}
                        </span>
                        <span className="text-sm font-semibold leading-tight">{i.topic}</span>
                      </span>
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">{cardLine(i, p)}</span>
                    <span className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className={`absolute inset-y-0 left-0 ${i.stage === "arsiv" ? "bg-border" : TONE_BAR[tag.tone]}`}
                        style={{ width: `${cardProgress(i, p, rules, now)}%` }}
                      />
                    </span>
                    <span className={`text-[11.5px] font-semibold ${TONE_TEXT[tag.tone]}`}>{tag.text}</span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </div>

      {item ? (
        <ContentCardDetail
          key={item.id}
          item={item}
          perf={perfOf(item.code)}
          rules={rules}
          now={now}
          videoUrl={videoUrls[item.id] ?? null}
          headingRef={headingRef}
          organic={organic[item.id] ? <OrganicNumbers info={organic[item.id]} /> : undefined}
          reel={reel}
        />
      ) : items.length > 0 ? (
        // Yeni açılan görev sayfa yenilenene kadar listede olmayabilir.
        <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">Kart yükleniyor…</p>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
          Henüz içerik yok. &quot;Yeni görev&quot; ile ilk Reels ya da sayfa görevini açın.
        </p>
      )}
    </div>
  );
}
