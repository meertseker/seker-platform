import { MessageCircle } from "lucide-react";
import { waMeUrl } from "@/lib/whatsapp";

interface WhatsAppButtonProps {
  phone: string;
  message?: string;
  compact?: boolean;
}

const BASE_CLASS =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-accent-soft font-semibold text-emerald-700 transition-colors hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Lead/öğrenci telefonu için tek-tik WhatsApp click-to-chat aksiyonu. Geçersiz telefonda null döner. */
export function WhatsAppButton({ phone, message, compact = false }: WhatsAppButtonProps) {
  const href = waMeUrl(phone, message);
  if (!href) return null;

  if (compact) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp'ta yaz"
        title="WhatsApp'ta yaz"
        className={`${BASE_CLASS} size-11 text-sm`}
      >
        <MessageCircle aria-hidden="true" className="size-4" />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${BASE_CLASS} min-h-11 px-3 py-2 text-sm`}
    >
      <MessageCircle aria-hidden="true" className="size-4" />
      WhatsApp
    </a>
  );
}
