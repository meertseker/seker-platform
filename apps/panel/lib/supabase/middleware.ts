import { createServerClient } from "@supabase/ssr";
import { authCookieOptions } from "@seker/auth/cookie";
import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_REASON_PARAM, hasAuthCookie } from "@/lib/login-reason";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Yenileme öncesi: çerez vardı ama oturum doğrulanamıyorsa kullanıcı düşürülmüştür (tek oturum kuralı).
  const hadSession = hasAuthCookie(request.cookies.getAll().map((c) => c.name));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() oturumu yeniler ve JWT'yi yerelde doğrular; getUser() gibi her
  // istekte (önceden yüklemeler dahil) Auth sunucusuna gitmez.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims.sub ?? null;
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // B7: sessizce /login'e düşmek yerine neden söylenir; sayfa bunu Türkçe gösterir.
    if (hadSession) url.searchParams.set(LOGIN_REASON_PARAM, "baska-cihaz");
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/bugun";
    return NextResponse.redirect(url);
  }

  return response;
}
