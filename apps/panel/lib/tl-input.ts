/**
 * Parses a user-typed TL amount string into a JS number, or `null` when the
 * value is empty/garbage/negative.
 *
 * Accepted shapes:
 *  - "22000"      -> 22000    (plain integer)
 *  - "22.000"     -> 22000    (dot = Turkish thousands separator)
 *  - "22.000,50"  -> 22000.5  (full Turkish format: dot groups + comma decimal)
 *  - "22000,5"    -> 22000.5  (comma = decimal separator)
 *  - "22000.5"    -> 22000.5  (bare dot with 1-2 trailing digits = decimal separator)
 *
 * Disambiguation rule: a comma always marks the decimal separator (and every
 * dot before it is then a thousands separator, stripped). Without a comma, a
 * *single* dot is treated as a decimal separator only when it has 1-2 digits
 * after it (matches `String(someNumber)` output, e.g. `22000.5`); a single
 * dot with exactly 3 trailing digits, or multiple dots, is treated as
 * Turkish thousands grouping and stripped. This closes the historical bug
 * where prefilling an input with `String(item.monthlyFeeTl)` (e.g.
 * `"22000.5"`) got re-parsed by a naive "strip all dots" parser into
 * `220005` — a silent 100x price corruption on re-save.
 */
export function parseTlInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let normalized: string;
  if (trimmed.includes(",")) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else {
    const dotCount = (trimmed.match(/\./g) ?? []).length;
    if (dotCount === 0) {
      normalized = trimmed;
    } else if (dotCount === 1) {
      const decimals = trimmed.split(".")[1]?.length ?? 0;
      normalized = decimals >= 1 && decimals <= 2 ? trimmed : trimmed.replace(/\./g, "");
    } else {
      normalized = trimmed.replace(/\./g, "");
    }
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

/**
 * Formats a TL amount for prefilling an editable text input, using a comma
 * as the decimal separator (no thousands grouping) so it round-trips
 * losslessly through {@link parseTlInput} — the counterpart fix to the
 * `String(number)` prefill bug described above.
 */
export function formatTlInput(tl: number): string {
  if (!Number.isFinite(tl)) return "";
  return tl.toString().replace(".", ",");
}
