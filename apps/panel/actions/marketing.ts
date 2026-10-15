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

/** BOM'a göre UTF-16LE (FF FE) / UTF-16BE (FE FF) veya UTF-8 olarak çözer. */
function decodeCsvBuffer(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    // Google Ads "Excel için CSV" dışa aktarımı UTF-16LE gelir.
    return buffer.subarray(2, buffer.length - (buffer.length % 2)).toString("utf16le");
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const body = buffer.subarray(2, buffer.length - ((buffer.length - 2) % 2));
    return Buffer.from(body).swap16().toString("utf16le");
  }
  return buffer.toString("utf8");
}

export async function importSpendCsv(
  formData: FormData,
): Promise<{ ok: true; count: number; warnings: string[]; warningCount: number } | { ok: false; error: string }> {
  try {
    const profile = await getSessionProfile();
    if (profile.role !== "yonetici") return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir" };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Bir CSV dosyası seçin" };
    if (!ALLOWED_EXTENSION.test(file.name)) return { ok: false, error: "Yalnızca CSV dosyası yükleyebilirsiniz" };
    if (file.size > MAX_CSV_BYTES) return { ok: false, error: "Dosya 2 MB'tan büyük olamaz" };

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, errors } = parseSpendCsv(decodeCsvBuffer(buffer));
    if (rows.length === 0) return { ok: false, error: errors[0] ?? "Dosyada okunabilir satır yok" };

    await supabaseAdsStore(createAdminSupabase()).upsertSpend(rows);
    revalidatePath("/pazarlama");
    return { ok: true, count: rows.length, warnings: errors.slice(0, 5), warningCount: errors.length };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    // Yalnızca hata sınıfı kaydedilir; dosya içeriği ve ham hata mesajı loglanmaz.
    console.error("[marketing] importSpendCsv başarısız:", error instanceof Error ? error.name : "bilinmeyen");
    return { ok: false, error: "CSV içe aktarılamadı, lütfen tekrar deneyin" };
  }
}

export async function retryConversionUpload(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const profile = await getSessionProfile();
    if (profile.role !== "yonetici") return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir" };
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Geçersiz kayıt" };

    // Yalnızca 'hata' satırları canlandırılır; 'atlandi' (rıza yok / kapsam dışı) asla.
    const { data, error } = await createAdminSupabase()
      .from("conversion_uploads")
      .update({ status: "bekliyor", error: null })
      .eq("id", id)
      .eq("status", "hata")
      .select("id");
    if (error) return { ok: false, error: "Kayıt güncellenemedi" };
    if (!data?.length) return { ok: false, error: "Yalnızca hatalı kayıtlar tekrar denenebilir" };

    revalidatePath("/pazarlama");
    return { ok: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("[marketing] retryConversionUpload başarısız:", error instanceof Error ? error.name : "bilinmeyen");
    return { ok: false, error: "Kayıt güncellenemedi" };
  }
}
