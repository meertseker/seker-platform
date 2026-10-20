import { createServerClient } from "@supabase/ssr";
import { authCookieOptions } from "@seker/auth/cookie";
import { gateTeacher } from "@/lib/role-access";
import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_REASON_PARAM, hasAuthCookie, loginReasonFor } from "@/lib/login-reason";

export async function updateSession(request: NextRequest) {
  // Sunucu layout'u yolu okuyabilsin (öğretmen yol kontrolü); istemciden gelen değer ezilir.
  request.headers.set("x-pathname", request.nextUrl.pathname);
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
  const { data, error } = await supabase.auth.getClaims();
  const user = data?.claims.sub ?? null;
  const isLogin = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // B7: sessizce /login'e düşmek yerine neden söylenir; sayfa bunu Türkçe gösterir.
    const reason = loginReasonFor(hadSession, error?.code);
    if (reason) url.searchParams.set(LOGIN_REASON_PARAM, reason);
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Öğretmen: yumuşak gezinti ve RSC istekleri layout'tan geçmez, kapı burada.
  const teacherTarget = user ? await gateTeacher(supabase, user, request.nextUrl.pathname) : null;
  if (teacherTarget) {
    const url = request.nextUrl.clone();
    url.pathname = teacherTarget;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
