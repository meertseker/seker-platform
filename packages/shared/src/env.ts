/** Sunucu tarafında zorunlu bir ortam değişkenini okur; yoksa açık bir hatayla durur. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Eksik ortam değişkeni: ${name}`);
  return value;
}
