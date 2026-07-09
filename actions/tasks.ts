"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

interface TaskMutationResult {
  error?: string;
  id?: string;
}

export async function completeTask(id: string): Promise<TaskMutationResult> {
  const supabase = await createServerSupabase();

  if (!id) return { error: "Görev bulunamadı." };

  const { data: task, error } = await supabase
    .from("tasks")
    .update({ status: "tamamlandi" })
    .eq("id", id)
    .eq("status", "acik")
    .select("id")
    .single();

  if (error?.code === "PGRST116" || !task) {
    return { error: "Görev zaten tamamlanmış." };
  }

  if (error) {
    return { error: "Görev tamamlanamadı." };
  }

  revalidatePath("/");
  return { id: task.id };
}
