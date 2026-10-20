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
