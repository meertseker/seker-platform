// Görevim ekranının saf yardımcıları: teşekkür ekranının korunması, başarısız taslağın geri konması, sekme adı.

export type TextPatch = { caption?: string; pageFields?: Record<string, string> };

type TabTask = { id: string; kind: "reels" | "sayfa"; header: string; status: string };

/**
 * Sunucu listesi + teslim edilip sunucu listesinden düşmüş ama teşekkür ekranı hâlâ açık olan görevler.
 * "Tamam"a basılınca done kaydı silinir ve görev listeden çıkar.
 */
export function visibleTasks<T extends { id: string }>(
  incoming: T[],
  held: Record<string, T>,
  done: Record<string, unknown>,
): T[] {
  const have = new Set(incoming.map((x) => x.id));
  const kept = Object.keys(done)
    .filter((id) => !have.has(id) && held[id])
    .map((id) => held[id]);
  return [...kept, ...incoming];
}

/** Kaydedilemeyen yama geri konur; aralarında yazılan daha yeni değer üstün gelir. */
export function mergePatch(failed: TextPatch, newer: TextPatch): TextPatch {
  return { ...failed, ...newer };
}

/**
 * Görevin ekranda görünen taslağı: yerelde değiştirilen alanlar (sekme değişse de korunur) sunucudan
 * gelenin üstüne konur; yerelde dokunulmayan alanlar sunucudan gelir.
 */
export function mergeDraft<T extends object>(server: T, local: Partial<T> | undefined): T {
  return { ...server, ...local };
}

export function tabLabel(task: TabTask, sameKindCount: number): string {
  const base =
    sameKindCount > 1 ? task.header.split(" · ")[0] : task.kind === "reels" ? "Reels görevi" : "Sayfa görevi";
  return task.status === "duzeltme" ? `${base} · düzeltme` : base;
}

export const OFFLINE_SAVE_MESSAGE = "Bağlantı yok, yazdıkların kaydedilemedi. Bağlantı gelince tekrar dene.";
