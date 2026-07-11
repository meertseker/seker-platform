"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import type { Program } from "@/lib/constants";
import { logEvent } from "@/lib/events";
import { createServerSupabase } from "@/lib/supabase/server";

interface PriceListActionResult {
  error?: string;
  id?: string;
}

const programs: Program[] = ["tam_gun", "yarim_gun", "uc_gun", "play_grup"];

function validProgram(value: string): value is Program {
  return programs.includes(value as Program);
}

function normalizeMoney(value: number, allowZero: boolean) {
  if (!Number.isFinite(value)) return null;
  if (allowZero ? value < 0 : value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function validSeason(value: string) {
  const match = /^(\d{4})-(\d{4})$/.exec(value.trim());
  if (!match) return false;
  return Number(match[2]) === Number(match[1]) + 1;
}

function revalidateSettingsViews() {
  revalidatePath("/ayarlar");
}

export async function createSeason(season: string): Promise<PriceListActionResult> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };

  const trimmed = season.trim();
  if (!validSeason(trimmed)) {
    return { error: "Sezon '2027-2028' formatında olmalı" };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("price_lists")
    .insert({ season: trimmed, is_active: false })
    .select("id")
    .single();

  if (error?.code === "23505") return { error: "Bu sezon zaten mevcut" };
  if (error || !data) return { error: "Sezon oluşturulamadı" };

  revalidateSettingsViews();
  return { id: data.id };
}

export async function setActiveSeason(id: string): Promise<PriceListActionResult> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };
  if (!id) return { error: "Fiyat listesi bulunamadı" };

  const supabase = await createServerSupabase();
  const { data: target } = await supabase
    .from("price_lists")
    .select("id, season")
    .eq("id", id)
    .maybeSingle();

  if (!target) return { error: "Fiyat listesi bulunamadı" };

  const { error: deactivateError } = await supabase
    .from("price_lists")
    .update({ is_active: false })
    .eq("is_active", true);

  if (deactivateError) return { error: "Sezon aktifleştirilemedi" };

  const { data: activated, error: activateError } = await supabase
    .from("price_lists")
    .update({ is_active: true })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (activateError || !activated) {
    return { error: "Sezon aktifleştirilemedi" };
  }

  await logEvent(supabase, {
    entityType: "price_list",
    entityId: id,
    eventType: "fiyat_listesi_guncellendi",
    actorId: profile.id,
    payload: { season: target.season, action: "sezon_aktiflestirildi" },
  });

  revalidateSettingsViews();
  return { id };
}

export async function upsertPriceItem(
  priceListId: string,
  program: Program,
  monthlyFeeTl: number,
  registrationFeeTl: number,
): Promise<PriceListActionResult> {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") return { error: "Bu işlem için yönetici yetkisi gerekir" };
  if (!priceListId) return { error: "Fiyat listesi bulunamadı" };
  if (!validProgram(program)) return { error: "Geçerli bir program seçin" };

  const monthlyFee = normalizeMoney(monthlyFeeTl, false);
  if (monthlyFee === null) return { error: "Geçerli bir aylık aidat girin" };

  const registrationFee = normalizeMoney(registrationFeeTl, true);
  if (registrationFee === null) return { error: "Geçerli bir kayıt ücreti girin" };

  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("price_list_items")
    .select("id, monthly_fee, registration_fee")
    .eq("price_list_id", priceListId)
    .eq("program", program)
    .maybeSingle();

  const { data: saved, error } = await supabase
    .from("price_list_items")
    .upsert(
      {
        price_list_id: priceListId,
        program,
        monthly_fee: monthlyFee,
        registration_fee: registrationFee,
      },
      { onConflict: "price_list_id,program" },
    )
    .select("id")
    .maybeSingle();

  if (error || !saved) return { error: "Fiyat kaydedilemedi" };

  await logEvent(supabase, {
    entityType: "price_list",
    entityId: priceListId,
    eventType: "fiyat_listesi_guncellendi",
    actorId: profile.id,
    payload: {
      program,
      oldMonthlyFee: existing ? Number(existing.monthly_fee) : null,
      newMonthlyFee: monthlyFee,
      oldRegistrationFee: existing ? Number(existing.registration_fee) : null,
      newRegistrationFee: registrationFee,
    },
  });

  revalidateSettingsViews();
  return { id: saved.id };
}
