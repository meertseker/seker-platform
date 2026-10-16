import type { ItemType } from "@/lib/constants";

const monthFormatter = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "Europe/Istanbul" });
const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Istanbul",
});

const ITEM_NOUNS: Record<ItemType, string> = {
  aidat: "aidatı",
  kayit_ucreti: "kayıt ücreti",
  servis: "servis ücreti",
  yemek: "yemek ücreti",
  kitap: "kitap - kırtasiye",
  diger: "ödemesi",
};

/** "Ekim aidatı", "Eylül kitap - kırtasiye" — velinin ve çalışanın konuştuğu ad. */
export function installmentLabel(itemType: ItemType, dueDate: string) {
  const month = monthFormatter.format(new Date(`${dueDate}T12:00:00+03:00`));
  const capital = month.charAt(0).toLocaleUpperCase("tr") + month.slice(1);
  return `${capital} ${ITEM_NOUNS[itemType] ?? "ödemesi"}`;
}

/** "12 Eki" */
export function shortDate(iso: string) {
  return shortDateFormatter.format(new Date(iso.length === 10 ? `${iso}T12:00:00+03:00` : iso));
}
