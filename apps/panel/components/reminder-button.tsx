"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { logPaymentReminder } from "@/actions/payments";
import { waMeUrl } from "@/lib/whatsapp";

interface ReminderButtonProps {
  studentId: string;
  installmentIds: string[];
  phone: string | null;
  message: string;
  big?: boolean;
}

/**
 * WhatsApp'ta hazır hatırlatma metnini açar ve "hatırlatıldı" izini kaydeder,
 * böylece aynı veliye iki kişi mesaj atmaz.
 */
export function ReminderButton({ studentId, installmentIds, phone, message, big = false }: ReminderButtonProps) {
  const router = useRouter();
  const href = phone ? waMeUrl(phone, message) : null;

  if (!href) {
    return (
      <span className="inline-flex min-h-12 items-center rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground">
        Telefon yok · öğrenci kartına ekleyin
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        void logPaymentReminder(studentId, installmentIds).then(() => router.refresh());
      }}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-accent-soft px-4 font-semibold text-emerald-800 transition-colors hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        big ? "min-h-14 text-base" : "min-h-12 text-sm"
      }`}
    >
      <MessageCircle aria-hidden className="size-5" />
      WhatsApp ile hatırlat
    </a>
  );
}
