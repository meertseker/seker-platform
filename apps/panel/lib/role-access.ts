export type Role = "yonetici" | "danisman" | "ogretmen";

/** Öğretmenin tek ekranı ve girişten sonra indiği yer. */
export const TEACHER_HOME = "/gorevim";

function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Rolün bu yolu açıp açamayacağı. Öğretmen yalnız /gorevim; /reklam yalnız yönetici. */
export function canOpen(role: Role, pathname: string): boolean {
  if (role === "ogretmen") return isUnder(pathname, TEACHER_HOME);
  if (isUnder(pathname, "/reklam")) return role === "yonetici";
  return true;
}

/** İzin verilmeyen yolda rolün düşeceği yer. */
export function homeFor(role: Role): string {
  return role === "ogretmen" ? TEACHER_HOME : "/bugun";
}

/** Middleware'in dokunmayacağı yollar. */
function isExempt(pathname: string) {
  return isUnder(pathname, "/login") || isUnder(pathname, "/api") || isUnder(pathname, "/_next");
}

/** Saf karar: öğretmen izinsiz yoldaysa gideceği yer, değilse null. */
export function teacherRedirectTarget(role: Role | null, pathname: string): string | null {
  if (role !== "ogretmen" || isExempt(pathname)) return null;
  return canOpen(role, pathname) ? null : TEACHER_HOME;
}

type ProfileReader = {
  from: (table: "profiles") => {
    select: (cols: "role") => {
      eq: (col: "id", id: string) => { single: () => PromiseLike<{ data: { role: string } | null }> };
    };
  };
};

/**
 * Middleware dalı (yumuşak gezinti ve RSC istekleri layout'tan geçmez): oturumlu kullanıcının
 * rolünü kendi profilinden okur; öğretmen izinsiz yoldaysa yönlendirme hedefini verir.
 * Profil okunamazsa null: ikinci katman (app)/layout.tsx ve RLS.
 */
export async function gateTeacher(supabase: unknown, userId: string, pathname: string): Promise<string | null> {
  if (isExempt(pathname)) return null;
  try {
    const { data } = await (supabase as ProfileReader).from("profiles").select("role").eq("id", userId).single();
    return teacherRedirectTarget((data?.role as Role | undefined) ?? null, pathname);
  } catch {
    return null;
  }
}
