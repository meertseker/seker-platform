// Veli görüşmeleri: öğrenci sayfası (geçmiş) ve Gecikenler (son görüşme, açık söz).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GorusmeRow } from "@/lib/veli-gorusmesi";

export interface GorusmeWithAuthor extends GorusmeRow {
  authorName: string | null;
}

interface DbRow extends GorusmeRow {
  author?: { full_name: string } | { full_name: string }[] | null;
}

const COLUMNS =
  "id, student_id, author_id, contacted_at, created_at, contact_with, outcome, note, promise_date, promise_amount, author:profiles!veli_gorusmeleri_author_id_fkey(full_name)";

/** Öğrencilerin görüşmeleri, yeniden eskiye. Okunamazsa boş liste (ekran yine açılır). */
export async function fetchGorusmeler(supabase: SupabaseClient, studentIds: string[]): Promise<GorusmeWithAuthor[]> {
  if (studentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("veli_gorusmeleri")
    .select(COLUMNS)
    .in("student_id", studentIds)
    .order("contacted_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error(`Veli görüşmeleri okunamadı: ${error.message}`);
    return [];
  }
  return ((data ?? []) as unknown as DbRow[]).map(({ author, ...row }) => ({
    ...row,
    authorName: (Array.isArray(author) ? author[0]?.full_name : author?.full_name) ?? null,
  }));
}
