import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const PATH = "/rls-test-ziyaret";
let yon: SupabaseClient;
let dan: SupabaseClient;
let anon: SupabaseClient;

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
  anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
});

afterAll(async () => {
  await admin.from("site_visit_daily").delete().eq("path", PATH);
});

describe("site_visit_daily (çerezsiz sayaç)", () => {
  it("service_role kaydeder; aynı gün ve satırda sayılar artar", async () => {
    expect((await admin.rpc("record_site_visit", { p_path: PATH, p_source: "arama", p_device: "mobil", p_entrance: true })).error).toBeNull();
    expect((await admin.rpc("record_site_visit", { p_path: PATH, p_source: "arama", p_device: "mobil", p_entrance: false })).error).toBeNull();
    const { data } = await admin.from("site_visit_daily").select("pageviews, entrances").eq("path", PATH);
    expect(data).toEqual([{ pageviews: 2, entrances: 1 }]);
  });

  it("geçersiz kaynak veritabanında da reddedilir", async () => {
    const { error } = await admin.rpc("record_site_visit", { p_path: PATH, p_source: "hack", p_device: "mobil", p_entrance: true });
    expect(error?.code).toBe("23514");
  });

  it("yönetici okur, danışman ve anonim okuyamaz", async () => {
    expect((await yon.from("site_visit_daily").select("path").eq("path", PATH)).data).toHaveLength(1);
    expect((await dan.from("site_visit_daily").select("path").eq("path", PATH)).data ?? []).toHaveLength(0);
    expect((await anon.from("site_visit_daily").select("path").eq("path", PATH)).data ?? []).toHaveLength(0);
  });

  it("anonim ve oturumlu kullanıcı sayacı doğrudan artıramaz", async () => {
    for (const client of [anon, dan, yon]) {
      const { error } = await client.rpc("record_site_visit", { p_path: PATH, p_source: "arama", p_device: "mobil", p_entrance: true });
      expect(error).not.toBeNull();
    }
  });
});
