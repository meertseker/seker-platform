import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const YON_ID = "00000000-0000-0000-0000-000000000001";
const DAN_ID = "00000000-0000-0000-0000-000000000002";
const TAG = "RLS-FB-";

async function cleanup() {
  await admin.from("notifications").delete().eq("type", "geri_bildirim").like("payload->>title", `${TAG}%`);
  await admin.from("feedback").delete().like("title", `${TAG}%`);
}

describe("feedback RLS", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("danışman kendi adına ekler; created_by varsayılan auth.uid()", async () => {
    const dan = await clientFor("danisman@test.local");
    const { data, error } = await dan.from("feedback").insert({ kind: "hata", title: `${TAG}kendi`, body: "Sayfa açılmıyor" }).select().single();
    expect(error).toBeNull();
    expect(data?.created_by).toBe(DAN_ID);
    expect(data?.status).toBe("yeni");
  });

  it("danışman başkası adına ekleyemez", async () => {
    const dan = await clientFor("danisman@test.local");
    const { error } = await dan.from("feedback").insert({ kind: "oneri", title: `${TAG}baskasi`, body: "x", created_by: YON_ID });
    expect(error).not.toBeNull();
  });

  it("danışman status 'yeni' dışında ekleyemez", async () => {
    const dan = await clientFor("danisman@test.local");
    const { error } = await dan.from("feedback").insert({ kind: "oneri", title: `${TAG}durum`, body: "x", status: "tamamlandi" });
    expect(error).not.toBeNull();
  });

  it("created_by/id/created_at kolonları istemciden yazılamaz", async () => {
    const dan = await clientFor("danisman@test.local");
    const base = { kind: "hata", body: "x" };
    expect((await dan.from("feedback").insert({ ...base, title: `${TAG}id`, id: "123e4567-e89b-12d3-a456-426614174000" })).error).not.toBeNull();
    expect((await dan.from("feedback").insert({ ...base, title: `${TAG}ts`, created_at: "2000-01-01T00:00:00Z" })).error).not.toBeNull();
    expect((await dan.from("feedback").insert({ ...base, title: `${TAG}cb`, created_by: DAN_ID })).error).not.toBeNull();
  });

  it("geçersiz tür ve kısa başlık reddedilir", async () => {
    const dan = await clientFor("danisman@test.local");
    expect((await dan.from("feedback").insert({ kind: "sikayet", title: `${TAG}tur`, body: "x" })).error).not.toBeNull();
    expect((await dan.from("feedback").insert({ kind: "hata", title: "ab", body: "x" })).error).not.toBeNull();
  });

  it("danışman başkasının kaydını göremez, yönetici hepsini görür", async () => {
    const yon = await clientFor("yonetici@test.local");
    await yon.from("feedback").insert({ kind: "oneri", title: `${TAG}yonetici`, body: "Yönetici önerisi" });
    const dan = await clientFor("danisman@test.local");
    const { data } = await dan.from("feedback").select("title, created_by").like("title", `${TAG}%`);
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.created_by === DAN_ID)).toBe(true);
    const { data: all } = await yon.from("feedback").select("title").like("title", `${TAG}%`);
    const titles = all!.map((r) => r.title);
    expect(titles).toContain(`${TAG}kendi`);
    expect(titles).toContain(`${TAG}yonetici`);
  });

  it("danışman durum/not güncelleyemez (kayıt değişmez)", async () => {
    const dan = await clientFor("danisman@test.local");
    const { data: mine } = await dan.from("feedback").select("id").eq("title", `${TAG}kendi`).single();
    await dan.from("feedback").update({ status: "tamamlandi" }).eq("id", mine!.id);
    await dan.from("feedback").update({ admin_note: "hack" }).eq("id", mine!.id);
    const { data } = await admin.from("feedback").select("status, admin_note").eq("id", mine!.id).single();
    expect(data).toEqual({ status: "yeni", admin_note: null });
  });

  it("yönetici status ve not günceller; başlığı değiştiremez", async () => {
    const yon = await clientFor("yonetici@test.local");
    const { data: row } = await admin.from("feedback").select("id, updated_at").eq("title", `${TAG}kendi`).single();
    const { error } = await yon.from("feedback").update({ status: "inceleniyor", admin_note: "Bakıyoruz" }).eq("id", row!.id);
    expect(error).toBeNull();
    const { data } = await admin.from("feedback").select("status, admin_note, updated_at").eq("id", row!.id).single();
    expect(data!.status).toBe("inceleniyor");
    expect(data!.admin_note).toBe("Bakıyoruz");
    expect(data!.updated_at >= row!.updated_at).toBe(true);
    const { error: e2 } = await yon.from("feedback").update({ title: "değişti" }).eq("id", row!.id);
    expect(e2).not.toBeNull();
    expect((await yon.from("feedback").update({ status: "bilinmeyen" }).eq("id", row!.id)).error).not.toBeNull();
  });

  it("yönetici yazar adını ilişkiyle birlikte okuyabilir (sayfa sorgusu)", async () => {
    const yon = await clientFor("yonetici@test.local");
    const { data, error } = await yon
      .from("feedback")
      .select("id, author:profiles!feedback_created_by_fkey(full_name)")
      .like("title", `${TAG}%`);
    expect(error).toBeNull();
    expect(data!.every((r) => (r.author as unknown as { full_name: string } | null)?.full_name)).toBe(true);
  });

  it("anon hiçbir şey okuyamaz/yazamaz", async () => {
    const anon = createClient(url, publishable, { auth: { persistSession: false } });
    const sel = await anon.from("feedback").select("id");
    expect(sel.error !== null || (sel.data ?? []).length === 0).toBe(true);
    const ins = await anon.from("feedback").insert({ kind: "hata", title: `${TAG}anon`, body: "x" });
    expect(ins.error).not.toBeNull();
  });

  it("ekleme yöneticilere geri_bildirim bildirimi oluşturur", async () => {
    const dan = await clientFor("danisman@test.local");
    const { data } = await dan.from("feedback").insert({ kind: "hata", title: `${TAG}bildirim`, body: "x" }).select("id").single();
    const { data: notes } = await admin.from("notifications").select("user_id, payload").eq("type", "geri_bildirim").eq("payload->>feedbackId", data!.id);
    expect(notes!.map((n) => n.user_id)).toEqual([YON_ID]);
    expect(notes![0].payload).toMatchObject({ feedbackId: data!.id, kind: "hata", title: `${TAG}bildirim` });
    expect((notes![0].payload as { by: string }).by).toBeTruthy();
  });

  it("saatte 20 kayıttan fazlası reddedilir", async () => {
    await cleanup();
    const dan = await clientFor("danisman@test.local");
    const rows = Array.from({ length: 20 }, (_, i) => ({ kind: "oneri", title: `${TAG}sinir-${i}`, body: "x" }));
    // Tek tek eklenir: toplu ekleme tetikleyicide aynı anlık görüntüyü görür.
    for (const row of rows) expect((await dan.from("feedback").insert(row)).error).toBeNull();
    const last = await dan.from("feedback").insert({ kind: "oneri", title: `${TAG}sinir-21`, body: "x" });
    expect(last.error?.code).toBe("P0001");
    expect(last.error?.message).toContain("Çok fazla geri bildirim");
    await cleanup();
  });
});
