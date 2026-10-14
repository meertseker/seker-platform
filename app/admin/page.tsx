import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isValidAdminSession } from '@/lib/adminAuth';
import { listWebsiteLeads } from '@/lib/websiteLeads';

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function AdminLogin({ error }: { error?: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-center font-display text-3xl text-ink">Leadler</h1>
      <p className="mt-2 text-center text-ink-soft">Ön görüşme taleplerini görmek için girin.</p>
      <form action="/api/admin/login" method="post" className="mt-8 rounded-3xl bg-white p-6 shadow-lg shadow-ink/5 md:p-8">
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
          Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border-2 border-rule bg-white px-4 py-3 text-ink focus:border-grape focus:outline-none focus:ring-1 focus:ring-grape"
        />
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-grape px-8 py-3 font-semibold text-white shadow-lg shadow-grape/30 transition hover:bg-ink"
        >
          Giriş
        </button>
      </form>
    </main>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  if (!isValidAdminSession(jar.get(ADMIN_COOKIE)?.value)) {
    return <AdminLogin error={params.error === '1' ? 'Şifre yanlış.' : undefined} />;
  }

  const password = process.env.ADMIN_PASSWORD ?? '';
  let leads: Awaited<ReturnType<typeof listWebsiteLeads>> = [];
  let loadError = '';
  try {
    leads = await listWebsiteLeads(password);
  } catch {
    loadError = 'Leadler yüklenemedi. Supabase bağlantısını kontrol edin.';
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-grape">Admin</p>
          <h1 className="font-display text-3xl text-ink">Ön görüşme talepleri</h1>
          <p className="mt-1 text-ink-soft">{leads.length} kayıt</p>
        </div>
        <form action="/api/admin/logout" method="post">
          <button
            type="submit"
            className="rounded-full border-2 border-rule px-5 py-2 text-sm font-semibold text-ink transition hover:bg-paper-warm"
          >
            Çıkış
          </button>
        </form>
      </div>

      {loadError ? <p className="mt-14 text-red-600">{loadError}</p> : null}

      {!loadError && leads.length === 0 ? (
        <p className="mt-14 text-ink-soft">Henüz talep yok.</p>
      ) : null}

      {leads.length > 0 ? (
        <div className="mt-10 overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-rule">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-rule text-ink-soft">
              <tr>
                <th className="px-5 py-3 font-semibold">Tarih</th>
                <th className="px-5 py-3 font-semibold">Ad</th>
                <th className="px-5 py-3 font-semibold">Telefon</th>
                <th className="px-5 py-3 font-semibold">Kaynak sayfa</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-rule last:border-0">
                  <td className="whitespace-nowrap px-5 py-3 text-ink-soft">{formatWhen(lead.created_at)}</td>
                  <td className="px-5 py-3 font-semibold text-ink">{lead.parent_name}</td>
                  <td className="px-5 py-3">
                    <a href={`tel:${lead.phone}`} className="text-grape underline-offset-2 hover:underline">
                      {lead.phone}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{lead.landing_path || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
