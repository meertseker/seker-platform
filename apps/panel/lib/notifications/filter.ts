// /bildirimler süzgeci: ?filtre=okunmamis | tumu (varsayılan tumu).
export type NotificationFilter = "tumu" | "okunmamis";

export function parseFilter(value: string | string[] | undefined): NotificationFilter {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "okunmamis" ? "okunmamis" : "tumu";
}
