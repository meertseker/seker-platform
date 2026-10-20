"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { linkAdToContent } from "@/actions/ad-changes";
import { AdChangeDialog, type AdChangeKind } from "@/components/ad-change-dialog";
import { useToast } from "@/components/toast";
import type { CampaignRow } from "@/lib/ads/campaigns";
import { instagramCodes, statusLabel } from "@/lib/ads/change-text";

type Filter = "all" | "google" | "meta";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "google", label: "Google" },
  { key: "meta", label: "Instagram" },
];

const tlFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const money = (kurus: number) => `${tlFormatter.format(Math.round(kurus / 100))} TL`;

const TONE_CLASS = { green: "text-accent", yellow: "text-warning", red: "text-destructive-strong" } as const;

type Props = {
  heading: React.ReactNode;
  children: React.ReactNode;
  rows: CampaignRow[];
  codes: { code: string; topic: string }[];
  gate: { red: boolean; labels: string[] };
  writeEnabled: boolean;
  scaleMaxPct: number;
  targetTl: number;
};

/** Kampanyalar tablosu: platform süzgeci, onaylı Durdur/Başlat/Bütçe ve kodsuz reklamı koda bağlama. */
export function CampaignTable({ heading, children, rows, codes, gate, writeEnabled, scaleMaxPct, targetTl }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [target, setTarget] = useState<{ row: CampaignRow; kind: AdChangeKind } | null>(null);
  const shown = rows.filter((r) => filter === "all" || r.platform === filter);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {heading}
        <div role="group" aria-label="Platform" className="flex gap-1.5 rounded-xl bg-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`min-h-11 cursor-pointer rounded-lg px-3.5 text-sm font-semibold text-foreground ${filter === f.key ? "bg-surface shadow-sm" : "hover:bg-surface/60"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {children}

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
          Bu aralıkta kampanya, harcama ya da reklam velisi yok.
        </p>
      ) : (
        <div
          role="region"
          aria-label="Kampanya tablosu"
          tabIndex={0}
          className="overflow-x-auto rounded-2xl border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="border-b border-border px-3.5 py-2.5">Kampanya</th>
                <th scope="col" className="border-b border-border px-3.5 py-2.5 text-right">Harcama</th>
                <th scope="col" className="border-b border-border px-3.5 py-2.5 text-right">Gelen veli</th>
                <th scope="col" className="border-b border-border px-3.5 py-2.5 text-right">Nitelikli</th>
                <th scope="col" className="border-b border-border px-3.5 py-2.5 text-right">Randevu</th>
                <th scope="col" className="border-b border-border px-3.5 py-2.5 text-right">Kayıt</th>
                <th scope="col" className="border-b border-border px-3.5 py-2.5 text-right">Nitelikli veli başı</th>
                <th scope="col" className="border-b border-border px-3.5 py-2.5"><span className="sr-only">İşlemler</span></th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {shown.map((row) => (
                <Row key={row.key} row={row} codes={codes} onAction={(kind) => setTarget({ row, kind })} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Hedef: nitelikli veli başı en fazla {tlFormatter.format(targetTl)} TL (Ayarlar ve hedefler&apos;den değişir). Yeşil = hedefin altında, kırmızı = 2 katından fazla.
      </p>

      <AdChangeDialog
        target={target}
        onClose={() => setTarget(null)}
        gate={gate}
        writeEnabled={writeEnabled}
        scaleMaxPct={scaleMaxPct}
      />
    </div>
  );
}

function Row({ row, codes, onAction }: { row: CampaignRow; codes: { code: string; topic: string }[]; onAction: (kind: AdChangeKind) => void }) {
  const cell = "border-b border-border px-3.5 py-3 text-right";
  const status = statusLabel(row);
  const actionable = row.objectId !== "" && row.status !== null;
  const noData = row.spendKurus === 0 && row.qualified === 0;
  return (
    <tr className={row.depth === 1 ? "bg-background/50" : undefined}>
      <th scope="row" className="border-b border-border px-3.5 py-3 text-left font-normal">
        <div className={`flex flex-wrap items-center gap-2 ${row.depth === 1 ? "pl-7" : ""}`}>
          <span
            className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${row.platform === "google" ? "bg-google-soft text-google" : "bg-instagram-soft text-instagram"}`}
          >
            {row.platform === "google" ? "Google" : "Instagram"}
          </span>
          <span className="font-semibold text-foreground">{row.name}</span>
          {status ? (
            <span className={`text-xs ${row.status === "durduruldu" ? "text-destructive-strong" : "text-muted-foreground"}`}>{status}</span>
          ) : null}
          {row.unmatched ? <LinkCode adId={row.objectId} codes={instagramCodes(codes)} /> : null}
        </div>
      </th>
      <td className={cell}>{row.spendKurus > 0 ? money(row.spendKurus) : "—"}</td>
      <td className={cell}>
        <div className="text-base font-bold text-foreground">{row.leads}</div>
        <div className="text-[11.5px] text-muted-foreground">platform: {row.platformResults}</div>
      </td>
      <td className={`${cell} text-base font-bold text-foreground`}>{row.qualified}</td>
      <td className={cell}>{row.appts}</td>
      <td className={cell}>{row.enrolled}</td>
      <td className={`${cell} font-bold ${noData ? "text-muted-foreground" : TONE_CLASS[row.cplTone]}`}>
        {noData ? "—" : row.cplKurus === null ? "nitelikli yok" : money(row.cplKurus)}
      </td>
      <td className="whitespace-nowrap border-b border-border px-3.5 py-3 text-right">
        {actionable ? (
          <div className="inline-flex gap-1.5">
            <button
              type="button"
              onClick={() => onAction("budget")}
              disabled={row.dailyBudgetTl === null}
              title={row.dailyBudgetTl === null ? "Günlük bütçe bu düzeyde değil (reklam setinde ya da paylaşılan bütçede)." : undefined}
              aria-label={`${row.name} günlük bütçe`}
              className="min-h-11 cursor-pointer rounded-lg border border-border bg-surface px-2.5 text-[13px] font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Bütçe
            </button>
            <button
              type="button"
              onClick={() => onAction(row.selfPaused ? "resume" : "pause")}
              aria-label={`${row.name} ${row.selfPaused ? "başlat" : "durdur"}`}
              className="min-h-11 cursor-pointer rounded-lg border border-border bg-surface px-2.5 text-[13px] font-semibold text-foreground hover:bg-muted"
            >
              {row.selfPaused ? "Başlat" : "Durdur"}
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

/** K11: kodsuz Meta reklamını son 8 haftanın içerik kodlarından birine bağlar. */
function LinkCode({ adId, codes }: { adId: string; codes: { code: string; topic: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(codes[0]?.code ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function link() {
    setError(null);
    startTransition(async () => {
      const result = await linkAdToContent("meta", adId, code);
      if ("ok" in result) {
        toast({ text: result.message });
        setOpen(false);
        router.refresh();
      } else setError(result.error);
    });
  }

  return (
    <>
      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11.5px] font-semibold text-warning">eşleşmemiş</span>
      {open ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {codes.length === 0 ? (
            <span className="text-xs text-muted-foreground">Son 8 haftada Reels (R-) kodu yok.</span>
          ) : (
            <>
              <label className="sr-only" htmlFor={`kod-${adId}`}>İçerik kodu</label>
              <select
                id={`kod-${adId}`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="min-h-11 max-w-56 rounded-lg border border-input bg-surface px-2 text-sm text-foreground"
              >
                {codes.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.topic}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={link}
                disabled={pending || !code}
                className="min-h-11 cursor-pointer rounded-lg bg-primary px-3 text-[13px] font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-50"
              >
                {pending ? "Bağlanıyor…" : "Bağla"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-11 cursor-pointer rounded-lg px-2 text-[13px] font-semibold text-muted-foreground hover:bg-muted"
          >
            Vazgeç
          </button>
          {error ? <span role="alert" className="text-xs text-destructive-strong">{error}</span> : null}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 cursor-pointer rounded-lg border border-border bg-surface px-2.5 text-[13px] font-semibold text-foreground hover:bg-muted"
        >
          Koda bağla
        </button>
      )}
    </>
  );
}
