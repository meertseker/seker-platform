"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@seker/auth/admin";
import { getSessionProfile } from "@/lib/auth";
import { parseSpendCsv } from "@/lib/ads/csv";
import { supabaseAdsStore } from "@/lib/ads/store";

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const ALLOWED_EXTENSION = /\.(csv|tsv|txt)$/i;

/** Next.js yönlendirmelerini (redirect) yakalamadan geçirmek için. */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function importSpendCsv(
  formData: FormData,
): Promise<{ ok: true; count: number; warnings: string[] } | { ok: false; error: string }> {
  try {
    const profile = await getSessionProfile();
    if (profile.role !== "yonetici") return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir" };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Bir CSV dosyası seçin" };
    if (!ALLOWED_EXTENSION.test(file.name)) return { ok: false, error: "Yalnızca CSV dosyası yükleyebilirsiniz" };
    if (file.size > MAX_CSV_BYTES) return { ok: false, error: "Dosya 2 MB'tan büyük olamaz" };

    const buffer = Buffer.from(await file.arrayBuffer());
    // Google Ads "Excel için CSV" dışa aktarımı UTF-16LE gelir (BOM: FF FE).
    const text = buffer[0] === 0xff && buffer[1] === 0xfe ? buffer.toString("utf16le") : buffer.toString("utf8");

    const { rows, errors } = parseSpendCsv(text);
    if (rows.length === 0) return { ok: false, error: errors[0] ?? "Dosyada okunabilir satır yok" };

    await supabaseAdsStore(createAdminSupabase()).upsertSpend(rows);
    revalidatePath("/pazarlama");
    return { ok: true, count: rows.length, warnings: errors.slice(0, 5) };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    // Yalnızca hata sınıfı kaydedilir; dosya içeriği ve ham hata mesajı loglanmaz.
    console.error("[marketing] importSpendCsv başarısız:", error instanceof Error ? error.name : "bilinmeyen");
    return { ok: false, error: "CSV içe aktarılamadı, lütfen tekrar deneyin" };
  }
}
