"use client";

import Link from "next/link";
import { Bell, BellOff, CheckCheck, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { markNotificationRead, markNotificationsRead } from "@/actions/notifications";
import { NotificationList } from "@/components/notification-list";
import {
  badgeLabel,
  classifySummaryResponse,
  reconcileOptimistic,
  summaryChanged,
  visibleUnreadCount,
  type BellSummary,
} from "@/lib/notifications/bell-state";

import type { NotificationItem } from "@/lib/queries/notifications";

export type { NotificationItem } from "@/lib/queries/notifications";

interface NotificationBellProps {
  notifications: NotificationItem[];
  unreadCount: number;
}

const SUMMARY_POLL_MS = 20_000;
const PAGE_REFRESH_MS = 60_000;

// Odak geri bele alınmasın diye: dışarıda tıklanan öğe zaten odak alabiliyorsa ona bırakılır.
const FOCUSABLE = "a, button, input, select, textarea, [tabindex]";

export function NotificationBell({ notifications, unreadCount }: NotificationBellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [, startTransition] = useTransition();

  // Menü açıldığı sayfaya bağlı: başka sayfaya geçilince kendiliğinden kapanır.
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const open = openPathname === pathname;

  // İyimser okundu durumu; sunucudan yeni veri gelince uzlaştırılır (işlem sürerken rozet geri yanmaz).
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [allRead, setAllRead] = useState(false);
  const [seed, setSeed] = useState({ notifications, unreadCount });
  if (seed.notifications !== notifications || seed.unreadCount !== unreadCount) {
    const next = reconcileOptimistic({
      readIds,
      allRead,
      prevItems: seed.notifications,
      items: notifications,
      unreadCount,
    });
    setSeed({ notifications, unreadCount });
    setReadIds(next.readIds);
    setAllRead(next.allRead);
  }

  const count = visibleUnreadCount({ unreadCount, items: notifications, readIds, allRead });

  // Ekran okuyucuya yalnızca sayı artınca duyurulur.
  const [prevCount, setPrevCount] = useState(count);
  const [announcement, setAnnouncement] = useState("");
  if (count !== prevCount) {
    setPrevCount(count);
    if (count > prevCount) setAnnouncement(`${count} okunmamış bildirim`);
  }

  // Özet uç noktasında görülen son durum; değişince sayfa yenilenir.
  const knownRef = useRef<BellSummary>({
    unread: unreadCount,
    latestId: notifications[0]?.id ?? null,
  });
  // Sunucudan gelen her yeni durum bilinen durum olur: kendi okumamızdan sonra boşuna yenileme yapılmaz.
  useEffect(() => {
    knownRef.current = { unread: unreadCount, latestId: notifications[0]?.id ?? null };
  }, [notifications, unreadCount]);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;

    async function check() {
      if (stopped || inFlight || document.hidden) return;
      inFlight = true;
      try {
        // Ara katman oturumsuz isteği girişe yönlendirir; manual ile bu yönlendirme görünür kalır.
        const response = await fetch("/api/notifications/summary", {
          cache: "no-store",
          redirect: "manual",
        });
        const verdict = classifySummaryResponse(response);
        // Oturum yoksa bu sayfada sormaya devam etmenin anlamı yok.
        if (verdict === "stop") {
          stop();
          return;
        }
        // Geçici hata "değişiklik yok" sayılır, asla "0 okunmamış" değil.
        if (verdict === "ignore") return;
        const body: unknown = await response.json();
        if (!body || typeof body !== "object") return;
        const { unread, latestId } = body as Record<string, unknown>;
        if (typeof unread !== "number") return;
        const next = { unread, latestId: typeof latestId === "string" ? latestId : null };
        if (summaryChanged(knownRef.current, next)) {
          knownRef.current = next;
          router.refresh();
        }
      } catch {
        // Ağ hatası: değişiklik yok sayılır.
      } finally {
        inFlight = false;
      }
    }

    function onVisibilityChange() {
      if (!document.hidden) void check();
    }

    const interval = window.setInterval(() => void check(), SUMMARY_POLL_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibilityChange);
    function stop() {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    return stop;
  }, [router]);

  useEffect(() => {
    // Bildirim olmasa da dakikada bir yenilenir: aranacaklar şeridi gibi sayfadaki
    // diğer canlı bilgiler de buna bağlı. Sekme arkadayken yenileme yapılmaz:
    // her yenileme sayfanın tüm sorgularını yeniden çalıştırır.
    const interval = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, PAGE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [router]);

  // Açılınca odak ilk bildirime (yoksa panele) geçer.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const firstRow = panel?.querySelector<HTMLElement>("[data-notification-row]");
    (firstRow ?? panel)?.focus({ preventScroll: true });
  }, [open]);

  // Escape ya da dışarı dokunuş kapatır; odak zile döner.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenPathname(null);
      buttonRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpenPathname(null);
      if (!target?.closest(FOCUSABLE)) buttonRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function openItem(item: NotificationItem) {
    setOpenPathname(null);
    if (item.read_at || allRead || readIds.has(item.id)) return;
    setReadIds((current) => new Set(current).add(item.id));
    // Gezinme beklemez; sonuç revalidatePath ile zile döner. Hata olursa iyimser okundu geri alınır.
    const revert = () =>
      setReadIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    markNotificationRead(item.id)
      .then((result) => {
        if (result && "error" in result && result.error) revert();
      })
      .catch(revert);
  }

  function markAllRead() {
    setAllRead(true);
    // Düğme devre dışı kalınca odak body'ye düşmesin.
    panelRef.current?.focus({ preventScroll: true });
    startTransition(async () => {
      try {
        const result = await markNotificationsRead();
        if ("error" in result && result.error) setAllRead(false);
      } catch {
        setAllRead(false);
      }
      // Yenileme gerekmez: eylemdeki revalidatePath sayfayı zaten tazeler.
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={count > 0 ? `Bildirimler, ${count} okunmamış` : "Bildirimler"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenPathname(open ? null : pathname)}
        className={`glass relative flex size-11 cursor-pointer items-center justify-center rounded-full text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          open ? "text-primary" : ""
        }`}
      >
        <Bell aria-hidden className="size-5" strokeWidth={open ? 2.25 : 2} />
        {count > 0 ? (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-bold leading-none text-on-primary tabular-nums shadow-[0_2px_6px_rgb(225_29_72/0.35)] ring-2 ring-background"
          >
            {badgeLabel(count)}
          </span>
        ) : null}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-label="Bildirimler"
          tabIndex={-1}
          className="glass-thick fixed inset-x-3 top-[4.25rem] z-50 flex max-h-[70dvh] origin-top-right animate-pop-in flex-col overflow-hidden rounded-3xl focus:outline-none md:absolute md:inset-x-auto md:right-0 md:top-14 md:max-h-[min(36rem,calc(100dvh-6rem))] md:w-96"
        >
          <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] py-2 pl-4 pr-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                Bildirimler
              </h2>
              <p className="text-xs text-muted-foreground tabular-nums">
                {count > 0 ? `${count} okunmamış` : "Hepsi okundu"}
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={count === 0}
              className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground disabled:opacity-60 disabled:hover:bg-transparent"
            >
              <CheckCheck aria-hidden className="size-4" />
              Tümünü okundu say
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span
                aria-hidden
                className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <BellOff className="size-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground">Her şey yolunda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Yeni bir gelişme olduğunda burada görünür.
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              <NotificationList
                items={notifications}
                onOpen={openItem}
                readIds={readIds}
                allRead={allRead}
              />
            </div>
          )}

          <Link
            href="/bildirimler"
            onClick={() => setOpenPathname(null)}
            className="flex min-h-11 shrink-0 items-center justify-center gap-1 border-t border-black/[0.06] px-4 text-sm font-semibold text-primary hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            Tüm bildirimler
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
