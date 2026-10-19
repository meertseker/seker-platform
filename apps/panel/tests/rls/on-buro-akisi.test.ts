import { describe, it, expect, afterAll } from "vitest";
import { clientFor, admin } from "./helpers";

const PREFIX = "+90500888";
let seq = 0;
const nextPhone = () => `${PREFIX}${String(++seq).padStart(4, "0")}`;

function args(over: Record<string, unknown> = {}) {
  return {
    p_parent_name: "Ön Büro Test Veli",
    p_phone: nextPhone(),
    p_gclid: "",
    p_utm: {},
    p_landing_path: "/kayit",
    p_consent_at: new Date().toISOString(),
    ...over,
  };
}

async function leadRow(id: string) {
  const { data, error } = await admin.from("leads").select("*").eq("id", id).single();
  expect(error).toBeNull();
  return data!;
}

afterAll(async () => {
  const { data } = await admin.from("leads").select("id").like("phone", `${PREFIX}%`);
  for (const l of data ?? []) {
    await admin.from("notifications").delete().eq("payload->>leadId", l.id);
  }
  await admin.from("leads").delete().like("phone", `${PREFIX}%`);
});

describe("ön büro akışı alanları", () => {
  it("create_web_lead p_meta ile nitelik alanlarını yazar", async () => {
    const { data, error } = await admin.rpc("create_web_lead", args({
      p_utm: { utm_content: "R-2645-A" },
      p_meta: { child_birth_month: 3, child_birth_year: 2023, district: "Beykent", start_window: "hemen", wants_whatsapp: true, silent: true },
    }));
    expect(error).toBeNull();
    const lead = await leadRow((data as { lead_id: string }).lead_id);
    expect(lead.channel).toBe("form");
    expect(lead.content_code).toBe("R-2645-A");
    expect(lead.district).toBe("Beykent");
    expect(lead.start_window).toBe("hemen");
    expect(lead.wants_whatsapp).toBe(true);
    expect(lead.is_qualified).toBe(false);
  });

  it("mükerrer başvuruda boş alanlar doldurulur", async () => {
    const a = args({ p_meta: { silent: true } });
    const first = await admin.rpc("create_web_lead", a);
    const id = (first.data as { lead_id: string }).lead_id;
    expect((await leadRow(id)).district).toBeNull();
    const second = await admin.rpc("create_web_lead", { ...a, p_meta: { silent: true, district: "Esenyurt", start_window: "3_6_ay" } });
    expect((second.data as { duplicate: boolean }).duplicate).toBe(true);
    const lead = await leadRow(id);
    expect(lead.district).toBe("Esenyurt");
    expect(lead.start_window).toBe("3_6_ay");
  });

  it("utm_content kod biçiminde değilse content_code boş kalır", async () => {
    const { data, error } = await admin.rpc("create_web_lead", args({
      p_utm: { utm_content: "kis_kampanyasi" },
      p_meta: { silent: true },
    }));
    expect(error).toBeNull();
    const lead = await leadRow((data as { lead_id: string }).lead_id);
    expect(lead.content_code).toBeNull();
    expect(lead.channel).toBe("form");
  });

  it("is_qualified dört işaret true olunca true", async () => {
    const { data } = await admin.rpc("create_web_lead", args({ p_meta: { silent: true } }));
    const id = (data as { lead_id: string }).lead_id;
    const { error } = await admin.from("leads")
      .update({ q_age_ok: true, q_area_ok: true, q_timing_ok: true, q_reached: true }).eq("id", id);
    expect(error).toBeNull();
    expect((await leadRow(id)).is_qualified).toBe(true);
  });

  it("danışman app_settings mesai okur ama yazamaz", async () => {
    const dan = await clientFor("danisman@test.local");
    const { data, error } = await dan.from("app_settings").select("value").eq("key", "mesai").single();
    expect(error).toBeNull();
    expect(data!.value).toEqual({ days: [1, 2, 3, 4, 5], start: "08:30", end: "18:00" });
    const { data: upd } = await dan.from("app_settings").update({ value: {} }).eq("key", "mesai").select();
    expect(upd ?? []).toHaveLength(0);
    const { data: after } = await admin.from("app_settings").select("value").eq("key", "mesai").single();
    expect(after!.value).toEqual({ days: [1, 2, 3, 4, 5], start: "08:30", end: "18:00" });
  });

  it("diğer ayar tohumları var", async () => {
    const { data } = await admin.from("app_settings").select("key, value")
      .in("key", ["servis_semtleri", "arama_metni", "fiyat_cevabi", "wa_sablonlari", "ustlenme_dk"]);
    expect(data).toHaveLength(5);
    const m = Object.fromEntries(data!.map((r) => [r.key, r.value]));
    expect(m.ustlenme_dk).toBe(15);
    expect(m.servis_semtleri).toHaveLength(6);
    expect(m.arama_metni).toHaveLength(4);
    expect((m.wa_sablonlari as { key: string }[]).map((x) => x.key)).toEqual(
      ["ulasilamadi", "ziyaret_saatleri", "randevu_onay", "ziyaret_tesekkur", "kontenjan"]);
  });

  it("whatsapp kaynağı ve yeni kayıp nedenleri kabul edilir", async () => {
    for (const [i, reason] of ["yas_uymuyor", "gelecek_yil"].entries()) {
      const { error } = await admin.from("leads").insert({
        parent_name: "Kayıp Test", phone: `${PREFIX}9${i}00`, source: "whatsapp",
        status: "kaybedildi", lost_reason: reason,
      });
      expect(error).toBeNull();
    }
  });

  it("tasks.due_at kolonu var", async () => {
    const { error } = await admin.from("tasks").select("due_at").limit(1);
    expect(error).toBeNull();
  });
});
