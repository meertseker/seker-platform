import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sayfa bulunamadı" };

export default function NotFound() {
  return (
    <main className="mx-auto mt-16 max-w-lg px-4 text-center">
      <section className="rounded-3xl bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Sayfa bulunamadı</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Aradığınız kayıt silinmiş ya da bağlantı hatalı olabilir.
        </p>
        <Link
          href="/bugun"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 py-3 text-base font-semibold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Bugün&apos;e dön
        </Link>
      </section>
    </main>
  );
}
