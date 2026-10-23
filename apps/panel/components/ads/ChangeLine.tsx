// Reklam kayıt satırı (K25): Kampanyalar'da satır altında gri küçük satır ve tablo altında en yeni değişiklik.
// Metin sunucuda changeLine ile hazırlanır; burada yalnız gösterilir.
import Link from "next/link";

const STATUSES = ["✓ Uygulandı", "Kaydedildi · uygulanmadı", "Hata"] as const;

function splitStatus(line: string): { status: string | null; rest: string } {
  const status = STATUSES.find((s) => line.startsWith(s)) ?? null;
  return status ? { status, rest: line.slice(status.length) } : { status: null, rest: line };
}

/** Satır altı: son değişiklik, gri küçük. */
export function ChangeLine({ line }: { line: string }) {
  return <p className="mt-1 text-xs font-normal leading-snug text-muted-foreground [overflow-wrap:anywhere]">{line}</p>;
}

/** Tablo altı: en yeni değişiklik ve "Tüm değişiklik kaydı" bağlantısı (Rapor kayıt defteri). */
export function LatestChangeLine({ line }: { line: string }) {
  const { status, rest } = splitStatus(line);
  const tone =
    status === "✓ Uygulandı"
      ? { box: "border-accent/30 bg-accent-soft", strong: "text-accent" }
      : status === "Hata"
        ? { box: "border-destructive/30 bg-destructive-soft", strong: "text-destructive-strong" }
        : { box: "border-border bg-muted", strong: "text-foreground" };
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border px-3 py-1.5 text-[13px] text-foreground ${tone.box}`}>
      <p className="min-w-0 flex-[1_1_320px] py-1 [overflow-wrap:anywhere]">
        {status ? <b className={tone.strong}>{status}</b> : null}
        {rest}
      </p>
      <Link
        href="/dashboard#reklam-kaydi"
        className={`inline-flex min-h-11 items-center rounded-lg px-1 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tone.strong}`}
      >
        Tüm değişiklik kaydı
      </Link>
    </div>
  );
}
