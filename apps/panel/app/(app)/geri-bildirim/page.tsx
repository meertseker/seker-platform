import { FeedbackAdminControls } from "@/components/feedback-admin-controls";
import { FeedbackForm } from "@/components/feedback-form";
import { getSessionProfile } from "@/lib/auth";
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  type FeedbackKind,
  type FeedbackStatus,
} from "@/lib/constants";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Geri bildirim" };

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<FeedbackStatus, string> = {
  yeni: "bg-primary-soft text-primary-strong",
  inceleniyor: "bg-amber-100 text-amber-900",
  tamamlandi: "bg-emerald-100 text-emerald-900",
  yapilmayacak: "bg-muted text-muted-foreground",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface FeedbackRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  page: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  created_by: string;
  author: { full_name: string } | null;
}

function Chip({ status }: { status: string }) {
  const known = status in FEEDBACK_STATUSES;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        known ? STATUS_CHIP[status as FeedbackStatus] : "bg-muted text-muted-foreground"
      }`}
    >
      {known ? FEEDBACK_STATUSES[status as FeedbackStatus] : status}
    </span>
  );
}

function FeedbackItem({
  row,
  showAuthor,
  admin,
  anchor = false,
}: {
  row: FeedbackRow;
  showAuthor: boolean;
  admin: boolean;
  anchor?: boolean;
}) {
  const kindLabel = FEEDBACK_KINDS[row.kind as FeedbackKind] ?? row.kind;
  return (
    <li
      id={anchor ? `gb-${row.id}` : undefined}
      className="scroll-mt-20 rounded-2xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip status={row.status} />
        <span className="text-xs font-semibold text-muted-foreground">{kindLabel}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {showAuthor && row.author ? `${row.author.full_name} · ` : ""}
          {dateFormatter.format(new Date(row.created_at))}
        </span>
      </div>
      <h3 className="mt-2 text-base font-semibold text-foreground">{row.title}</h3>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{row.body}</p>
      {row.page ? <p className="mt-2 text-xs text-muted-foreground">Ekran: {row.page}</p> : null}
      {row.admin_note && !admin ? (
        <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm text-foreground">Yönetici notu: {row.admin_note}</p>
      ) : null}
      {admin ? (
        <FeedbackAdminControls id={row.id} status={row.status as FeedbackStatus} adminNote={row.admin_note} />
      ) : null}
    </li>
  );
}

export default async function GeriBildirimPage() {
  const profile = await getSessionProfile();
  const isAdmin = profile.role === "yonetici";
  const supabase = await createServerSupabase();

  const columns = "id, kind, title, body, page, status, admin_note, created_at, created_by, author:profiles!feedback_created_by_fkey(full_name)";
  const [mineResult, allResult] = await Promise.all([
    supabase.from("feedback").select(columns).eq("created_by", profile.id).order("created_at", { ascending: false }).limit(100),
    isAdmin
      ? supabase.from("feedback").select(columns).order("created_at", { ascending: false }).limit(200)
      : Promise.resolve(null),
  ]);
  const mine = (mineResult.data ?? []) as unknown as FeedbackRow[];
  const all = (allResult?.data ?? []) as unknown as FeedbackRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Geri bildirim</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bir hata mı gördünüz ya da bir fikriniz mi var? Buradan yazın; yöneticiye anında bildirim gider.
        </p>
      </div>

      <FeedbackForm />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Gönderdiklerim</h2>
        {mineResult.error ? (
          <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
            Geri bildirimleriniz yüklenemedi. Sayfayı yenileyin.
          </p>
        ) : mine.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
            Henüz bir geri bildirim göndermediniz.
          </p>
        ) : (
          <ul className="space-y-3">
            {mine.map((row) => (
              <FeedbackItem key={row.id} row={row} showAuthor={false} admin={false} anchor={!isAdmin} />
            ))}
          </ul>
        )}
      </section>

      {isAdmin ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Tüm bildirimler</h2>
          {allResult?.error ? (
            <p className="rounded-2xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700">
              Bildirimler yüklenemedi. Sayfayı yenileyin.
            </p>
          ) : all.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">
              Henüz geri bildirim yok.
            </p>
          ) : (
            <ul className="space-y-3">
              {all.map((row) => (
                <FeedbackItem key={row.id} row={row} showAuthor admin anchor />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
