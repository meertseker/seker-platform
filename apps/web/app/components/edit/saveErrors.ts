/**
 * Kaydet çağrısının fırlattığı istisnayı sınıflar. Oturum, çakışma ve doğrulama hataları istisna değildir;
 * saveContent onları `{ ok: false, error }` olarak döndürür. Buraya yalnızca taşıma katmanı hataları düşer.
 *
 * - 'version': sekme eski (ya da yeni) bir derlemeden kalmış; sunucu eylemin kimliğini tanımıyor
 *   (Next `UnrecognizedActionError`, "Failed to find Server Action") veya deploy sırasında ara sunucu
 *   RSC olmayan bir yanıt döndürdü.
 * - 'network': istek sunucuya hiç ulaşmadı (konteyner yeniden başlıyor ya da bağlantı koptu).
 * - 'other': beklenmeyen hata.
 */
export type SaveErrorKind = 'version' | 'network' | 'other';

export function classifySaveError(err: unknown): SaveErrorKind {
  if (!err || typeof err !== 'object') return 'other';
  const name = 'name' in err ? String((err as { name: unknown }).name) : '';
  const message = 'message' in err ? String((err as { message: unknown }).message) : '';
  // Next bu sınıfa adı açıkça verir (this.name = 'UnrecognizedActionError'); küçültmede bozulmaz.
  if (name === 'UnrecognizedActionError') return 'version';
  if (/Server Action .* (was not found|not found on the server)|Failed to find Server Action/i.test(message)) return 'version';
  if (/unexpected response was received from the server/i.test(message)) return 'version';
  if (name === 'TypeError' && /fetch|network|load failed/i.test(message)) return 'network';
  return 'other';
}
