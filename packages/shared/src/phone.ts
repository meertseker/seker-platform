/** Türk cep telefonunu E.164'e normalize eder. Geçersizse null. */
export function normalizeTurkishPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let rest: string;
  if (digits.startsWith('0090')) rest = digits.slice(4);
  else if (digits.startsWith('90') && digits.length === 12) rest = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) rest = digits.slice(1);
  else if (digits.length === 10) rest = digits;
  else return null;
  if (rest.length !== 10 || !rest.startsWith('5')) return null;
  return `+90${rest}`;
}
