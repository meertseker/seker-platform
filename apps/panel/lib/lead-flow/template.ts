// Hazır mesaj şablonları: {veli} ve {danisman} doldurulur; bilinmeyen yer tutucu olduğu gibi kalır.
export function fillTemplate(text: string, vars: { veli: string; danisman: string }): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(vars, key) ? vars[key as keyof typeof vars] : match,
  );
}
