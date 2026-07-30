"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/actions/auth";

const initialState: SignInState | null = null;

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Şeker Anaokulu" className="mx-auto size-20 object-contain" />
          <p className="mt-3 text-sm font-bold text-foreground">Şeker CRM</p>
          <h1 className="mt-2 text-2xl font-semibold">Giriş Yap</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Yönetici veya danışman hesabınızla devam edin.
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground"
            >
              E-posta
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="yonetici@test.local"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Şifreniz"
            />
          </div>

          {state?.error ? (
            <p
              role="alert"
              className="rounded-xl bg-destructive-soft px-4 py-3 text-sm font-medium text-red-700"
            >
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="min-h-11 w-full cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>
      </section>
    </main>
  );
}
