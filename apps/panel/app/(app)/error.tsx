"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="mx-auto mt-10 max-w-lg rounded-3xl bg-surface p-6 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-foreground">Sayfa yüklenemedi</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Bağlantı kopmuş ya da geçici bir sorun olmuş olabilir. Girdiğiniz bilgiler kaydedilmediyse tekrar deneyin.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="min-h-12 cursor-pointer rounded-xl bg-primary px-5 py-3 text-base font-semibold text-on-primary hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Tekrar dene
        </button>
        <Link
          href="/bugun"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-5 py-3 text-base font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Bugün&apos;e dön
        </Link>
      </div>
      {error.digest ? <p className="mt-4 text-xs text-muted-foreground">Hata kodu: {error.digest}</p> : null}
    </section>
  );
}
