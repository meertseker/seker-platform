import { MessageCircle } from "lucide-react";

export interface MessageTemplateLink {
  key: string;
  label: string;
  /** Doldurulmuş mesaj metni (önizleme). */
  text: string;
  /** wa.me linki; telefon geçersizse null. */
  href: string | null;
}

/** Hazır mesajlar: dokununca personelin kendi WhatsApp'ında doldurulmuş açılır (K3). */
export function MessageTemplates({ items }: { items: MessageTemplateLink[] }) {
  if (items.length === 0) return null;
  const usable = items.some((item) => item.href);
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-muted-foreground">Hazır mesajlar</h2>
      <ul className="mt-2.5 space-y-2">
        {items.map((item) =>
          item.href ? (
            <li key={item.key}>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MessageCircle aria-hidden className="size-5 shrink-0 text-accent" />
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-foreground">{item.label}</span>
                  <span className="text-muted-foreground"> · “{item.text}”</span>
                </span>
              </a>
            </li>
          ) : null,
        )}
      </ul>
      <p className="mt-2.5 text-xs text-muted-foreground">
        {usable
          ? "Mesajları okul yazar, yönetici onaylar. Dokununca WhatsApp'ta hazır açılır."
          : "Telefon numarası geçersiz olduğu için WhatsApp açılamıyor."}
      </p>
    </section>
  );
}
