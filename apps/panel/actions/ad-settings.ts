"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AdSettings } from "@/lib/ads/ad-settings";

function int(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function num(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

/** Girdiyi doğrular; hata varsa Türkçe mesaj, yoksa temizlenmiş ayarları döner. */
function validate(input: AdSettings): { error: string } | { value: AdSettings } {
  if (!input || typeof input !== "object") return { error: "Geçersiz istek." };
  const g = input.gates ?? ({} as AdSettings["gates"]);
  const b = input.monthlyBudget ?? ({} as AdSettings["monthlyBudget"]);
  const l = input.limits ?? ({} as AdSettings["limits"]);

  if (!int(input.targetTl, 0, 1_000_000)) return { error: "Hedef maliyet 0 ya da daha büyük bir tam sayı olmalı." };
  if (!num(input.stopMultiple, 1, 10)) return { error: "Durdurma katı 1 ile 10 arasında olmalı." };
  if (!int(input.winMin, 1, 50)) return { error: "Kazandı için en az nitelikli veli sayısı 1 ile 50 arasında olmalı." };
  if (!int(input.noResultWeeks, 1, 52)) return { error: "Sonuçsuz hafta sayısı 1 ile 52 arasında olmalı." };
  if (!num(input.scaleMaxPct, 0, 100)) return { error: "Büyütme yüzdesi 0 ile 100 arasında olmalı." };
  if (!num(input.fatigueFrequency, 0, 100)) return { error: "Yorgunluk sıklığı 0 ile 100 arasında olmalı." };
  if (!num(input.fatigueCtrDropPct, 0, 100)) return { error: "Tıklama oranı düşüşü 0 ile 100 arasında olmalı." };

  if (!int(g.firstCallMin, 1, 240)) return { error: "İlk arama süresi 1 ile 240 dakika arasında olmalı." };
  if (!num(g.reachPct, 0, 100)) return { error: "Ulaşma yüzdesi 0 ile 100 arasında olmalı." };
  if (!num(g.apptPct, 0, 100)) return { error: "Randevu yüzdesi 0 ile 100 arasında olmalı." };
  if (!num(g.showPct, 0, 100)) return { error: "Gelme yüzdesi 0 ile 100 arasında olmalı." };

  if (!int(b.googleTl, 0, 100_000_000)) return { error: "Google aylık bütçesi 0 ya da daha büyük bir tam sayı olmalı." };
  if (!int(b.metaTl, 0, 100_000_000)) return { error: "Meta aylık bütçesi 0 ya da daha büyük bir tam sayı olmalı." };

  const banned = [...new Set((Array.isArray(input.banned) ? input.banned : []).map((s) => String(s).trim()).filter(Boolean))];
  if (banned.length > 50) return { error: "En fazla 50 yasaklı ifade girilebilir." };
  if (banned.some((s) => s.length < 2 || s.length > 40)) return { error: "Her yasaklı ifade 2 ile 40 karakter arasında olmalı." };

  if (!int(l.reelsCaption, 1, 2200)) return { error: "Reels açıklama sınırı 1 ile 2200 arasında olmalı." };
  if (!int(l.pageTitle, 1, 200)) return { error: "Sayfa başlığı sınırı 1 ile 200 arasında olmalı." };
  if (!int(l.min, 0, 200)) return { error: "En az karakter 0 ile 200 arasında olmalı." };

  return {
    value: {
      targetTl: input.targetTl,
      stopMultiple: input.stopMultiple,
      winMin: input.winMin,
      noResultWeeks: input.noResultWeeks,
      scaleMaxPct: input.scaleMaxPct,
      fatigueFrequency: input.fatigueFrequency,
      fatigueCtrDropPct: input.fatigueCtrDropPct,
      gates: { firstCallMin: g.firstCallMin, reachPct: g.reachPct, apptPct: g.apptPct, showPct: g.showPct },
      monthlyBudget: { googleTl: b.googleTl, metaTl: b.metaTl },
      banned,
      limits: { reelsCaption: l.reelsCaption, pageTitle: l.pageTitle, min: l.min },
    },
  };
}

export async function saveAdSettings(input: AdSettings): Promise<{ ok: true } | { error: string }> {
  await requireRole("yonetici");

  const checked = validate(input);
  if ("error" in checked) return checked;
  const v = checked.value;

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("app_settings").upsert(
      [
        {
          key: "reklam_kurallari",
          value: {
            hedef_nitelikli_tl: v.targetTl,
            durdur_kat: v.stopMultiple,
            kazan_min_nitelikli: v.winMin,
            sonucsuz_hafta: v.noResultWeeks,
            buyutme_yuzde: v.scaleMaxPct,
            yorgunluk_siklik: v.fatigueFrequency,
            yorgunluk_ctr_dusus_yuzde: v.fatigueCtrDropPct,
          },
        },
        {
          key: "kapi_esikleri",
          value: {
            ilk_arama_dk: v.gates.firstCallMin,
            ulasma_yuzde: v.gates.reachPct,
            randevu_yuzde: v.gates.apptPct,
            gelme_yuzde: v.gates.showPct,
          },
        },
        { key: "aylik_butce", value: { google_tl: v.monthlyBudget.googleTl, meta_tl: v.monthlyBudget.metaTl } },
        { key: "yasakli_ifadeler", value: v.banned },
        {
          key: "icerik_limitleri",
          value: { reels_aciklama: v.limits.reelsCaption, sayfa_baslik: v.limits.pageTitle, en_az: v.limits.min },
        },
      ],
      { onConflict: "key" },
    );
    if (error) return { error: "Kaydedilemedi, tekrar deneyin." };
  } catch {
    return { error: "Kaydedilemedi, tekrar deneyin." };
  }
  revalidatePath("/reklam/ayarlar");
  revalidatePath("/reklam/icerik");
  revalidatePath("/gorevim");
  return { ok: true };
}
