"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { applyAdChange } from "@/actions/ad-changes";
import { Sheet } from "@/components/sheet";
import { useToast } from "@/components/toast";
import type { CampaignRow } from "@/lib/ads/campaigns";
import { dialogLines, reasonToSend, type AdChangeKind } from "@/lib/ads/change-text";

export type { AdChangeKind };

const MIN_REASON = 10;
const PLATFORM_LABEL = { google: "Google", meta: "Instagram" } as const;
const tl = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

type Props = {
  target: { row: CampaignRow; kind: AdChangeKind } | null;
  onClose: () => void;
  /** Sunucuda hesaplanan bu haftanın kapı durumu (yalnız uyarı; asıl denetim değişiklik kapısında). */
  gate: { red: boolean; labels: string[] };
  writeEnabled: boolean;
  scaleMaxPct: number;
};

/** Durdur / Başlat / Bütçe onay penceresi. Tek onay; kırmızı kapıda bütçe artışı gerekçe ister. */
export function AdChangeDialog({ target, onClose, gate, writeEnabled, scaleMaxPct }: Props) {
  const targetKey = target ? `${target.row.key}:${target.kind}` : null;
  const [shownKey, setShownKey] = useState(targetKey);
  const [budgetText, setBudgetText] = useState(target ? String(defaultBudget(target.row, scaleMaxPct)) : "");
  // Yeni hedef açılınca bütçe alanı varsayılana döner (render sırasında türetilen durum).
  if (targetKey !== shownKey) {
    setShownKey(targetKey);
    if (target) setBudgetText(String(defaultBudget(target.row, scaleMaxPct)));
  }
  const nextTl = target ? parseBudget(budgetText, target.row.dailyBudgetTl ?? 0).nextTl : 0;
  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={target ? dialogTitle(target.row, target.kind, nextTl) : ""}
      description={target ? `${PLATFORM_LABEL[target.row.platform]} · ${target.row.name}` : undefined}
    >
      {target ? (
        <DialogBody
          key={targetKey}
          row={target.row}
          kind={target.kind}
          gate={gate}
          writeEnabled={writeEnabled}
          budgetText={budgetText}
          setBudgetText={setBudgetText}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
}

function parseBudget(text: string, current: number): { valid: boolean; nextTl: number } {
  const parsed = Number(text.replace(",", "."));
  const valid = text.trim() !== "" && Number.isFinite(parsed) && parsed >= 1 && parsed <= 1_000_000;
  return { valid, nextTl: valid ? Math.round(parsed * 100) / 100 : current };
}

function defaultBudget(row: CampaignRow, scaleMaxPct: number): number {
  const current = row.dailyBudgetTl ?? 0;
  return Math.round(current * (1 + scaleMaxPct / 100));
}

function changePct(current: number, next: number): string {
  if (current <= 0) return "";
  const pct = Math.round(((next - current) / current) * 100);
  return pct >= 0 ? ` (+%${pct})` : ` (−%${Math.abs(pct)})`;
}

function dialogTitle(row: CampaignRow, kind: AdChangeKind, nextTl: number): string {
  if (kind === "pause") return "Durdurulsun mu?";
  if (kind === "resume") return "Yeniden başlatılsın mı?";
  const current = row.dailyBudgetTl ?? 0;
  return `Günlük bütçe ${tl.format(current)} TL → ${tl.format(nextTl)} TL${changePct(current, nextTl)}`;
}

type BodyProps = {
  row: CampaignRow;
  kind: AdChangeKind;
  gate: { red: boolean; labels: string[] };
  writeEnabled: boolean;
  budgetText: string;
  setBudgetText: (v: string) => void;
  onClose: () => void;
};

function DialogBody({ row, kind, gate, writeEnabled, budgetText, setBudgetText, onClose }: BodyProps) {
  const router = useRouter();
  const toast = useToast();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [serverWarn, setServerWarn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = row.dailyBudgetTl ?? 0;
  const { valid: budgetValid, nextTl } = parseBudget(budgetText, current);
  const increase = kind === "budget" && nextTl > current;
  const gateWarn = increase && gate.red;
  const warnText = serverWarn
    ? serverWarn
    : gateWarn
      ? `Bu hafta bir kapı kırmızı (${gate.labels.join(", ")}). Bütçe artışı önerilmiyor. Yine de yapacaksanız nedenini yazın.`
      : null;
  const needsReason = kind === "budget" && warnText !== null;
  const reasonOk = reason.trim().length >= MIN_REASON;
  const canSubmit = !pending && (kind !== "budget" || (budgetValid && nextTl !== current)) && (!needsReason || reasonOk);

  const lines = dialogLines(row, kind, { writeEnabled, currentTl: current, nextTl });

  const okLabel = kind === "pause" ? "Durdur" : kind === "resume" ? "Başlat" : increase ? "Bütçeyi artır" : "Bütçeyi azalt";

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await applyAdChange({
        platform: row.platform,
        level: row.level,
        objectId: row.objectId,
        objectName: row.name,
        kind,
        ...(kind === "budget" ? { newDailyBudgetTl: nextTl } : {}),
        // Uyarı artık geçerli değilse (ör. tutar düşürüldü) yazılmış gerekçe gönderilmez.
        ...(reasonToSend(needsReason, reason) ? { reason: reasonToSend(needsReason, reason) } : {}),
        source: "kampanyalar",
      });
      if ("ok" in result) {
        toast({ text: result.message });
        onClose();
        router.refresh();
        return;
      }
      if (result.needsReason) setServerWarn(result.error);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {kind === "budget" ? (
        <div className="space-y-1">
          <label htmlFor={`${ids}-butce`} className="block text-sm font-semibold text-foreground">
            Yeni günlük bütçe
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`${ids}-butce`}
              type="number"
              inputMode="decimal"
              min={1}
              step="any"
              value={budgetText}
              onChange={(e) => {
                setBudgetText(e.target.value);
                setServerWarn(null);
              }}
              aria-invalid={!budgetValid || undefined}
              className="min-h-11 w-40 rounded-xl border border-input bg-surface px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-sm text-muted-foreground">TL / gün · şu an {tl.format(current)} TL</span>
          </div>
        </div>
      ) : null}

      <ul className="space-y-1.5 text-[15px] leading-relaxed text-foreground">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span aria-hidden="true" className="text-muted-foreground">•</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>

      {warnText ? (
        <div className="space-y-2 rounded-xl bg-destructive-soft p-3 text-sm text-destructive-strong">
          <p role="alert">{warnText}</p>
          <label htmlFor={`${ids}-neden`} className="block font-semibold">
            Neden (zorunlu, en az {MIN_REASON} karakter)
          </label>
          <textarea
            id={`${ids}-neden`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            required
            aria-invalid={(reason.length > 0 && !reasonOk) || undefined}
            className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ) : null}

      {!writeEnabled ? (
        <p className="text-sm text-muted-foreground">Canlı yazım kapalı: işlem kaydedilir, platforma gönderilmez.</p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive-soft p-3 text-sm text-destructive-strong">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="min-h-12 cursor-pointer rounded-xl bg-primary px-5 text-[15px] font-bold text-on-primary hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "İşleniyor…" : okLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="min-h-12 cursor-pointer rounded-xl border border-border bg-surface px-4 text-[15px] font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
