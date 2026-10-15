"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

const createSchema = z.object({
  kind: z.enum(["hata", "oneri"], { message: "Bildirim türünü seçin" }),
  title: z
    .string({ message: "Başlık gerekli" })
    .trim()
    .min(3, "Başlık en az 3 karakter olmalı")
    .max(120, "Başlık en fazla 120 karakter olabilir"),
  body: z
    .string({ message: "Açıklama gerekli" })
    .trim()
    .min(1, "Açıklama yazın")
    .max(4000, "Açıklama en fazla 4000 karakter olabilir"),
  page: z
    .string()
    .trim()
    .max(200, "Ekran adı en fazla 200 karakter olabilir")
    .nullish()
    .transform((value) => (value ? value : null)),
});

const updateSchema = z.object({
  id: z.uuid({ message: "Geçersiz kayıt" }),
  status: z.enum(["yeni", "inceleniyor", "tamamlandi", "yapilmayacak"], { message: "Geçersiz durum" }),
  adminNote: z
    .string()
    .trim()
    .max(2000, "Not en fazla 2000 karakter olabilir")
    .nullish()
    .transform((value) => (value ? value : null)),
});

export async function createFeedback(input: unknown): Promise<Result> {
  try {
    const profile = await getSessionProfile();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi" };

    const supabase = await createServerSupabase();
    const { error } = await supabase.from("feedback").insert({ ...parsed.data, created_by: profile.id });
    if (error) {
      console.error("[feedback] createFeedback başarısız:", error.code ?? "bilinmeyen");
      return { ok: false, error: "Geri bildiriminiz gönderilemedi, lütfen tekrar deneyin" };
    }
    revalidatePath("/geri-bildirim");
    return { ok: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("[feedback] createFeedback başarısız:", error instanceof Error ? error.name : "bilinmeyen");
    return { ok: false, error: "Geri bildiriminiz gönderilemedi, lütfen tekrar deneyin" };
  }
}

export async function updateFeedbackStatus(input: unknown): Promise<Result> {
  try {
    const profile = await getSessionProfile();
    if (profile.role !== "yonetici") return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir" };
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi" };

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("feedback")
      .update({ status: parsed.data.status, admin_note: parsed.data.adminNote })
      .eq("id", parsed.data.id)
      .select("id");
    if (error) return { ok: false, error: "Kayıt güncellenemedi" };
    if (!data || data.length === 0) return { ok: false, error: "Kayıt bulunamadı" };
    revalidatePath("/geri-bildirim");
    return { ok: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("[feedback] updateFeedbackStatus başarısız:", error instanceof Error ? error.name : "bilinmeyen");
    return { ok: false, error: "Kayıt güncellenemedi" };
  }
}
