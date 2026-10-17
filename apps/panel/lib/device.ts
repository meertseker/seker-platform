/**
 * İstek telefondan mı? Chromium "Sec-CH-UA-Mobile" başlığını gönderir; diğer
 * tarayıcılar için kullanıcı ajanındaki "Mobi" / "iPhone" / "Android ... Mobile"
 * izine bakılır. Tabletler masaüstü düzenini alır.
 */
export function isPhoneRequest(headers: Headers): boolean {
  const hint = headers.get("sec-ch-ua-mobile");
  if (hint) return hint === "?1";
  const userAgent = headers.get("user-agent") ?? "";
  return /Mobi|iPhone|iPod|Android.*Mobile/i.test(userAgent);
}
