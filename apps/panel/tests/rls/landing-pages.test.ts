import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

// 0024: reklam sayfası satırları (landing_pages) ve öğretmenin özet RPC'si
// (content_owner_summary). Okuma: yönetici hepsi, öğretmen yalnız kendi içeriğininki;
// yazma yalnız service_role. Özet para alanı taşımaz.
const YON_ID = "00000000-0000-0000-0000-000000000001";
const DAN_ID = "00000000-0000-0000-0000-000000000002";
const OGR_ID = "00000000-0000-0000-0000-000000000004";
const OGR2_ID = "00000000-0000-0000-0000-000000000005";
const WEEK = "2026-10-19"; // Pazartesi

let ogr: SupabaseClient, ogr2: SupabaseClient, dan: SupabaseClient, yon: SupabaseClient;
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

// Kodlar S-99xx-I; temizlik diğer RLS dosyaları gibi _-99% (yarım kalmış koşuların artığı dahil).
let seq = 0;
function nextCode() {
  seq += 1;
  return `S-${9960 + seq}-I`;
}
const token = () => randomBytes(32).toString("base64url");

async function cleanup() {
  const { data: leads } = await admin.from("leads").select("id").like("content_code", "_-99%");
  const ids = (leads ?? []).map((l) => l.id as string);
  if (ids.length) {
    await admin.from("events").delete().in("entity_id", ids);
    await admin.from("leads").delete().in("id", ids);
  }
  // landing_pages satırları content_id cascade ile silinir.
  await admin.from("content_items").delete().like("code", "_-99%");
}

async function newContent(owner: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin.from("content_items").insert({
    code: nextCode(), kind: "sayfa", platform: "instagram", week_start: WEEK,
    topic: "Sayfa RLS test", owner_id: owner, created_by: YON_ID, ...extra,
  }).select().single();
  if (error) throw error;
  return data as { id: string; code: string };
}

async function newPage(contentId: string, extra: Record<string, unknown> = {}) {
  return admin.from("landing_pages")
    .insert({ content_id: contentId, preview_token: token(), ...extra })
    .select().single();
}

let ogrContent: { id: string; code: string };
let ogr2Content: { id: string; code: string };
let ogrPageId: string;
let ogr2PageId: string;

beforeAll(async () => {
  await cleanup();
  ogr = await clientFor("ogretmen@test.local");
  ogr2 = await clientFor("ogretmen2@test.local");
  dan = await clientFor("danisman@test.local");
  yon = await clientFor("yonetici@test.local");

  ogrContent = await newContent(OGR_ID, { approved_by: YON_ID });
  ogr2Content = await newContent(OGR2_ID);
  const p1 = await newPage(ogrContent.id);
  if (p1.error) throw p1.error;
  ogrPageId = p1.data!.id;
  const p2 = await newPage(ogr2Content.id);
  if (p2.error) throw p2.error;
  ogr2PageId = p2.data!.id;
});

afterAll(async () => {
  await cleanup();
});

describe("landing_pages RLS", () => {
  it("öğretmen kendi içeriğinin sayfa satırını okur, başkasınınkini okuyamaz", async () => {
    const { data, error } = await ogr.from("landing_pages").select("id, content_id")
      .in("id", [ogrPageId, ogr2PageId]);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: ogrPageId, content_id: ogrContent.id }]);
  });

  it("öğretmen sayfa satırı ekleyemez ve güncelleyemez", async () => {
    const other = await newContent(OGR_ID);
    const ins = await ogr.from("landing_pages").insert({ content_id: other.id, preview_token: token() });
    expect(ins.error).not.toBeNull();

    const upd = await ogr.from("landing_pages").update({ fields: { h1: "x" } }).eq("id", ogrPageId).select();
    if (!upd.error) expect(upd.data).toEqual([]);
    const { data } = await admin.from("landing_pages").select("fields").eq("id", ogrPageId).single();
    expect(data!.fields).toEqual({});
  });

  it("danışman ve anonim sayfa satırını okuyamaz", async () => {
    for (const c of [dan, anon]) {
      const { data } = await c.from("landing_pages").select("id").in("id", [ogrPageId, ogr2PageId]);
      expect(data ?? []).toEqual([]);
    }
  });

  it("yönetici hepsini okur", async () => {
    const { data, error } = await yon.from("landing_pages").select("id").in("id", [ogrPageId, ogr2PageId]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});

describe("landing_pages kısıtları", () => {
  it("kod slug'ı ve onizleme yasak, kurala uymayan adres yasak", async () => {
    for (const slug of ["beykent-anaokulu", "onizleme", "AB"]) {
      const c = await newContent(OGR_ID);
      const r = await newPage(c.id, { slug });
      expect(r.error?.code, slug).toBe("23514");
    }
  });

  it("yayında satırın slug'ı boş olamaz", async () => {
    const c = await newContent(OGR_ID);
    const r = await newPage(c.id, { status: "yayinda", slug: null });
    expect(r.error).not.toBeNull();
  });

  it("yayından sonra slug değişmez", async () => {
    const c = await newContent(OGR_ID);
    const draft = await newPage(c.id, { slug: "rls-taslak-adres" });
    if (draft.error) throw draft.error;
    const u1 = await admin.from("landing_pages").update({ slug: "rls-taslak-adres-2" }).eq("id", draft.data!.id);
    expect(u1.error).toBeNull();

    const c2 = await newContent(OGR_ID);
    const live = await newPage(c2.id, {
      slug: "rls-yayin-adres", status: "yayinda", published_at: "2026-10-23T09:00:00Z", published_by: YON_ID,
    });
    if (live.error) throw live.error;
    const u2 = await admin.from("landing_pages").update({ slug: "rls-yayin-adres-2" }).eq("id", live.data!.id);
    expect(u2.error?.code).toBe("23514");
    // Slug'a dokunmayan güncellemeler (arşive alma) serbest.
    const u3 = await admin.from("landing_pages")
      .update({ status: "arsiv", archived_at: "2026-10-24T09:00:00Z" })
      .eq("id", live.data!.id);
    expect(u3.error).toBeNull();

    // published_at temizlense de taslak dışı satırın adresi değişmez.
    const u4 = await admin.from("landing_pages").update({ published_at: null }).eq("id", live.data!.id);
    expect(u4.error).toBeNull();
    const u5 = await admin.from("landing_pages").update({ slug: "rls-yayin-adres-3" }).eq("id", live.data!.id);
    expect(u5.error?.code).toBe("23514");
  });

  it("aynı slug ikinci satırda 23505", async () => {
    const a = await newPage((await newContent(OGR_ID)).id, { slug: "rls-ayni-adres" });
    expect(a.error).toBeNull();
    const b = await newPage((await newContent(OGR_ID)).id, { slug: "rls-ayni-adres" });
    expect(b.error?.code).toBe("23505");
  });
});

describe("content_owner_summary", () => {
  beforeAll(async () => {
    const leads = [
      { parent_name: "Sayfa RLS Veli 1", phone: "+905000009961", source: "reklam", content_code: ogrContent.code, status: "yeni" },
      { parent_name: "Sayfa RLS Veli 2", phone: "+905000009962", source: "reklam", content_code: ogrContent.code, status: "yeni" },
      {
        parent_name: "Sayfa RLS Veli 3", phone: "+905000009963", source: "reklam", content_code: ogrContent.code,
        status: "kazanildi",
      },
    ];
    const { data, error } = await admin.from("leads").insert(leads).select("id, parent_name");
    if (error) throw error;
    const byName = new Map(data!.map((l) => [l.parent_name as string, l.id as string]));
    const l1 = byName.get("Sayfa RLS Veli 1")!;
    const l2 = byName.get("Sayfa RLS Veli 2")!;
    const appts = [
      { lead_id: l1, scheduled_at: "2026-11-02T09:00:00Z", type: "okul_ziyareti", created_by: DAN_ID, outcome: "bekliyor" },
      { lead_id: l1, scheduled_at: "2026-11-03T09:00:00Z", type: "okul_ziyareti", created_by: DAN_ID, outcome: "bekliyor" },
      { lead_id: l2, scheduled_at: "2026-11-04T09:00:00Z", type: "okul_ziyareti", created_by: DAN_ID, outcome: "iptal" },
    ];
    const r = await admin.from("appointments").insert(appts);
    if (r.error) throw r.error;
  });

  it("sayıları döner", async () => {
    const { data, error } = await ogr.rpc("content_owner_summary");
    expect(error).toBeNull();
    const row = (data as Record<string, unknown>[]).find((x) => x.code === ogrContent.code);
    expect(row).toMatchObject({ content_id: ogrContent.id, leads: 3, appointments: 1, enrolled: 1 });
    expect(row!.approved_by_name).toBe("Mehtap");
  });

  it("başkasının içeriğini döndürmez", async () => {
    const { data, error } = await ogr2.rpc("content_owner_summary");
    expect(error).toBeNull();
    const codes = (data as { code: string }[]).map((x) => x.code);
    expect(codes).not.toContain(ogrContent.code);
    expect(codes).toContain(ogr2Content.code);
  });

  it("anonim çağıramaz", async () => {
    const { error } = await anon.rpc("content_owner_summary");
    expect(error).not.toBeNull();
  });

  it("para alanı yok", async () => {
    const { data } = await ogr.rpc("content_owner_summary");
    const row = (data as Record<string, unknown>[]).find((x) => x.code === ogrContent.code)!;
    expect(Object.keys(row).sort()).toEqual(
      ["content_id", "code", "leads", "appointments", "enrolled", "last_sync_at", "approved_by_name"].sort(),
    );
  });
});
