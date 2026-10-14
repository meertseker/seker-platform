type SupabaseConfig = {
  url: string;
  key: string;
};

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

export async function supabaseRest(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<Response | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const { prefer, headers, ...rest } = init;
  return fetch(`${config.url}${path}`, {
    ...rest,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers,
    },
  });
}
