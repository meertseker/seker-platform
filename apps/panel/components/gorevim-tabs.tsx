import Link from "next/link";

const TABS = [
  { key: "gorevler", href: "/gorevim", label: "Görevler" },
  { key: "icerigim", href: "/gorevim/icerigim", label: "İçeriğim" },
] as const;

/** Görevim ekranının iki sekmesi: açık görevler ve teslim edilen içeriklerin durumu. */
export function GorevimTabs({ active }: { active: "gorevler" | "icerigim" }) {
  return (
    <nav aria-label="Görevim" className="mx-auto w-full max-w-[34rem]">
      <ul className="flex gap-1.5 rounded-xl bg-muted p-1">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key} className="flex-1">
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 items-center justify-center rounded-[9px] px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
