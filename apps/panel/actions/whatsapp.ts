"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { runWaFlush } from "@/lib/wa/run";
import {
  ensureSessionStarted,
  getQrDataUrl,
  getSession,
  listGroups,
  logoutSession,
  readWahaConfig,
  sendText,
  type WahaGroup,
  type WahaStatus,
} from "@/lib/wa/waha";

export interface WaConnection {
  configured: boolean;
  status: WahaStatus | "HATA";
  phone: string | null;
  name: string | null;
  qr: string | null;
  error?: string;
}

async function requireYonetici() {
  const profile = await getSessionProfile();
  if (profile.role !== "yonetici") throw new Error("Bu ayarı yalnızca yönetici değiştirebilir.");
  return profile;
}

function phoneFromJid(jid: string | undefined | null): string | null {
  const digits = jid?.split("@")[0]?.split(":")[0];
  return digits ? `+${digits}` : null;
}

/** Bağlantı durumu; QR bekleniyorsa güncel QR kodu da gelir. */
export async function getWaConnection(): Promise<WaConnection> {
  await requireYonetici();
  const cfg = readWahaConfig();
  if (!cfg) return { configured: false, status: "YOK", phone: null, name: null, qr: null };
  try {
    const session = await getSession(cfg);
    const qr = session.status === "SCAN_QR_CODE" ? await getQrDataUrl(cfg) : null;
    return {
      configured: true,
      status: session.status,
      phone: phoneFromJid(session.me?.id),
      name: session.me?.pushName ?? null,
      qr,
    };
  } catch (e) {
    return { configured: true, status: "HATA", phone: null, name: null, qr: null, error: (e as Error).message.slice(0, 200) };
  }
}

/** Oturumu başlatır; telefon bağlı değilse WAHA QR üretmeye başlar. */
export async function startWaConnection(): Promise<WaConnection> {
  await requireYonetici();
  const cfg = readWahaConfig();
  if (!cfg) return { configured: false, status: "YOK", phone: null, name: null, qr: null };
  try {
    await ensureSessionStarted(cfg);
  } catch (e) {
    return { configured: true, status: "HATA", phone: null, name: null, qr: null, error: (e as Error).message.slice(0, 200) };
  }
  return getWaConnection();
}

export async function disconnectWa(): Promise<{ error?: string }> {
  await requireYonetici();
  const cfg = readWahaConfig();
  if (!cfg) return { error: "WhatsApp servisi yapılandırılmamış." };
  const supabase = await createServerSupabase();
  await supabase.from("app_settings").upsert({ key: "wa_enabled", value: false });
  try {
    await logoutSession(cfg);
  } catch (e) {
    return { error: `Çıkış yapılamadı: ${(e as Error).message.slice(0, 160)}` };
  }
  revalidatePath("/ayarlar");
  return {};
}

export async function listWaGroups(): Promise<{ groups: WahaGroup[]; error?: string }> {
  await requireYonetici();
  const cfg = readWahaConfig();
  if (!cfg) return { groups: [], error: "WhatsApp servisi yapılandırılmamış." };
  try {
    return { groups: await listGroups(cfg) };
  } catch (e) {
    return { groups: [], error: `Gruplar alınamadı: ${(e as Error).message.slice(0, 160)}` };
  }
}

export async function saveWaGroup(groupId: string, groupName: string): Promise<{ error?: string }> {
  await requireYonetici();
  if (groupId && !groupId.endsWith("@g.us")) return { error: "Geçersiz grup." };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("app_settings").upsert([
    { key: "wa_group_id", value: groupId },
    { key: "wa_group_name", value: groupName },
  ]);
  if (error) return { error: "Kaydedilemedi, tekrar deneyin." };
  revalidatePath("/ayarlar");
  return {};
}

export async function setWaEnabled(enabled: boolean): Promise<{ error?: string }> {
  await requireYonetici();
  const supabase = await createServerSupabase();
  if (enabled) {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "wa_group_id").maybeSingle();
    if (typeof data?.value !== "string" || !data.value) return { error: "Önce bildirimlerin gideceği grubu seçin." };
  }
  const { error } = await supabase.from("app_settings").upsert({ key: "wa_enabled", value: enabled });
  if (error) return { error: "Kaydedilemedi, tekrar deneyin." };
  revalidatePath("/ayarlar");
  return {};
}

export async function sendWaTest(): Promise<{ error?: string }> {
  const profile = await requireYonetici();
  const cfg = readWahaConfig();
  if (!cfg) return { error: "WhatsApp servisi yapılandırılmamış." };
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "wa_group_id").maybeSingle();
  const groupId = typeof data?.value === "string" ? data.value : "";
  if (!groupId) return { error: "Önce grubu seçin." };
  try {
    await sendText(cfg, groupId, `✅ *Şeker Panel bağlantı testi*\nBu gruba panel bildirimleri gelecek.\n— ${profile.full_name}`);
  } catch (e) {
    return { error: `Gönderilemedi: ${(e as Error).message.slice(0, 160)}` };
  }
  return {};
}

/** Hatalı mesajları yeniden kuyruğa alır ve hemen göndermeyi dener. */
export async function retryWaFailed(): Promise<{ error?: string; retried?: number }> {
  await requireYonetici();
  const { createAdminSupabase } = await import("@seker/auth/admin");
  const db = createAdminSupabase();
  const { data, error } = await db
    .from("wa_outbox")
    .update({ status: "bekliyor", attempts: 0, error: null, available_at: new Date().toISOString(), created_at: new Date().toISOString() })
    .eq("status", "hata")
    .select("id");
  if (error) return { error: "Yeniden denenemedi." };
  await runWaFlush().catch(() => null);
  revalidatePath("/ayarlar");
  return { retried: data?.length ?? 0 };
}
