import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientFor, admin } from "./helpers";

const DAN_ID = "00000000-0000-0000-0000-000000000002";
const KEY = "test.rls.title";
let yon: SupabaseClient, dan: SupabaseClient, anon: SupabaseClient;

beforeAll(async () => {
  yon = await clientFor("yonetici@test.local");
  dan = await clientFor("danisman@test.local");
  anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  await admin.from("site_content").delete().like("key", "test.%");
  await admin.from("content_revisions").delete().like("key", "test.%");
  await admin.from("profiles").update({ can_edit_site: false }).eq("id", DAN_ID);
});

afterAll(async () => {
  await admin.from("site_content").delete().like("key", "test.%");
  await admin.from("content_revisions").delete().like("key", "test.%");
  await admin.from("profiles").update({ can_edit_site: false }).eq("id", DAN_ID);
});

const edit = (value: unknown, baseUpdatedAt: string | null) => [{ key: KEY, kind: "text", value, baseUpdatedAt }];

describe("site_content RLS", () => {
  it("anon okuyabilir, yazamaz", async () => {
    await admin.from("site_content").insert({ key: "test.rls.read", value: "x", kind: "text" });
    const { data } = await anon.from("site_content").select("key").eq("key", "test.rls.read");
    expect(data).toHaveLength(1);
    const { error } = await anon.from("site_content").insert({ key: "test.rls.anon", value: "x", kind: "text" });
    expect(error).not.toBeNull();
  });

  it("editör olmayan danışman save_site_content çağıramaz", async () => {
    const { error } = await dan.rpc("save_site_content", { p_edits: edit("a", null) });
    expect(error?.code).toBe("42501");
  });

  it("danışman kendi can_edit_site bayrağını açamaz (RLS: 0 satır etkilenir)", async () => {
    const { data, error } = await dan.from("profiles").update({ can_edit_site: true }).eq("id", DAN_ID).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
    const { data: row } = await admin.from("profiles").select("can_edit_site").eq("id", DAN_ID).single();
    expect(row!.can_edit_site).toBe(false);
  });

  it("guard tetikleyicisi: UPDATE izni olsa bile yönetici olmayan bayrağı değiştiremez", () => {
    // RLS'i aşan geçici politika ile tetikleyicinin kendisi sınanır; işlem geri alınır.
    const sql = `begin;
create policy tmp_upd on public.profiles for update to authenticated using (true) with check (true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"${DAN_ID}","role":"authenticated"}', true);
update public.profiles set can_edit_site = true where id = '${DAN_ID}';
reset role;
select 'RESULT:' || can_edit_site from public.profiles where id = '${DAN_ID}';
rollback;`;
    let out: string;
    try {
      out = execFileSync("docker", ["exec", "-i", "supabase_db_anaokulcrm", "psql", "-U", "postgres", "-At"], {
        input: sql,
        encoding: "utf8",
      });
    } catch (e) {
      throw new Error("docker/psql gerekli (yerel Supabase konteyneri supabase_db_anaokulcrm): " + String(e));
    }
    expect(out).toContain("RESULT:false");
  });

  it("yönetici set_can_edit_site ile bayrağı açar", async () => {
    const { error } = await yon.rpc("set_can_edit_site", { p_user: DAN_ID, p_value: true });
    expect(error).toBeNull();
    const { data } = await admin.from("profiles").select("can_edit_site").eq("id", DAN_ID).single();
    expect(data!.can_edit_site).toBe(true);
  });

  it("editör kaydeder, revizyon yazılır", async () => {
    const { data, error } = await dan.rpc("save_site_content", { p_edits: edit("İlk", null) });
    expect(error).toBeNull();
    expect(data.conflicts).toEqual([]);
    const { data: row } = await admin.from("site_content").select("value, updated_by").eq("key", KEY).single();
    expect(row!.value).toBe("İlk");
    expect(row!.updated_by).toBe(DAN_ID);
    const { data: revs } = await admin.from("content_revisions").select("old_value,new_value").eq("key", KEY);
    expect(revs).toEqual([{ old_value: null, new_value: "İlk" }]);
  });

  it("eski baseUpdatedAt ile kayıt çakışma döner ve hiçbir şey yazmaz", async () => {
    const { data: cur } = await dan.from("site_content").select("updated_at").eq("key", KEY).single();
    const first = await dan.rpc("save_site_content", { p_edits: edit("İkinci", cur!.updated_at) });
    expect(first.data.conflicts).toEqual([]);
    const stale = await dan.rpc("save_site_content", {
      p_edits: [
        { key: "test.rls.other", kind: "text", value: "yan", baseUpdatedAt: null },
        { key: KEY, kind: "text", value: "Üçüncü", baseUpdatedAt: cur!.updated_at },
      ],
    });
    expect(stale.data.conflicts).toEqual([KEY]);
    const { data: other } = await admin.from("site_content").select("key").eq("key", "test.rls.other");
    expect(other).toHaveLength(0);
  });

  it("value null satırı siler (koddaki varsayılana döner)", async () => {
    const { data: cur } = await dan.from("site_content").select("updated_at").eq("key", KEY).single();
    const res = await dan.rpc("save_site_content", { p_edits: edit(null, cur!.updated_at) });
    expect(res.data.conflicts).toEqual([]);
    const { data } = await admin.from("site_content").select("key").eq("key", KEY);
    expect(data).toHaveLength(0);
  });

  it("yeni anahtarda eski (null) tabanla ikinci kayıt çakışma döner", async () => {
    const k = "test.rls.newkey";
    const mk = (v: string) => [{ key: k, kind: "text", value: v, baseUpdatedAt: null }];
    const a = await dan.rpc("save_site_content", { p_edits: mk("A") });
    expect(a.data.conflicts).toEqual([]);
    const b = await dan.rpc("save_site_content", { p_edits: mk("B") });
    expect(b.data.conflicts).toEqual([k]);
    const { data } = await admin.from("site_content").select("value").eq("key", k).single();
    expect(data!.value).toBe("A");
  });

  it("revizyonlar değiştirilemez ve silinemez", async () => {
    const { data: rev } = await admin
      .from("content_revisions").select("id,new_value").eq("key", KEY).limit(1).single();
    const upd = await dan.from("content_revisions").update({ new_value: "hack" }).eq("id", rev!.id).select();
    expect(upd.data ?? []).toHaveLength(0);
    const del = await dan.from("content_revisions").delete().eq("id", rev!.id).select();
    expect(del.data ?? []).toHaveLength(0);
    const { data } = await admin.from("content_revisions").select("id,new_value").eq("id", rev!.id).single();
    expect(data).toEqual(rev);
  });

  it("anon yalnızca yayındaki duyuruları görür", async () => {
    await admin.from("announcements").insert([
      { title: "test yayında", body: "<p>a</p>", starts_on: "2020-01-01", published: true, sort: 0 },
      { title: "test taslak", body: "<p>b</p>", starts_on: "2020-01-01", published: false, sort: 0 },
      { title: "test bitti", body: "<p>c</p>", starts_on: "2020-01-01", ends_on: "2020-02-01", published: true, sort: 0 },
    ]);
    const { data } = await anon.from("active_announcements").select("title").like("title", "test %");
    expect(data!.map((r) => r.title)).toEqual(["test yayında"]);
    await admin.from("announcements").delete().like("title", "test %");
  });
  it("anon active_announcements üzerinden media_assets gömebilir mi (T18 F10 kararı)", async () => {
    const { data: asset, error: aerr } = await admin
      .from("media_assets")
      .insert({ s3_key: "test/embed-" + Date.now() + ".webp", width: 10, height: 10, alt: "test alt", faces: "yok" })
      .select("id")
      .single();
    expect(aerr).toBeNull();
    await admin.from("announcements").insert({
      title: "test gömülü", body: "<p>a</p>", starts_on: "2020-01-01", published: true, sort: 0, image_id: asset!.id,
    });
    const embed = await anon.from("active_announcements").select("id, media_assets(s3_key, alt)").like("title", "test %");
    await admin.from("announcements").delete().like("title", "test %");
    await admin.from("media_assets").delete().eq("id", asset!.id);
    // Karar (F10): embed çalışıyor; getAnnouncements tek sorgu kullanır. PGRST200 dönerse ikinci sorguya geçilmeli.
    expect(embed.error).toBeNull();
    expect(embed.data![0]).toMatchObject({ media_assets: { alt: "test alt" } });
  });
  it("reorder_announcements: editör sıralar (eşit sort dahil), editör olmayan ve anon yapamaz", async () => {
    await admin.from("announcements").delete().like("title", "test ord%");
    const { data: rows } = await admin
      .from("announcements")
      .insert(["a", "b", "c"].map((t) => ({ title: "test ord " + t, body: "<p>x</p>", published: false, sort: 0 })))
      .select("id,title");
    const idOf = (t: string) => rows!.find((r) => r.title === "test ord " + t)!.id;
    const order = async () => {
      const { data } = await admin.from("announcements").select("title,sort,id").like("title", "test ord%").order("sort").order("id");
      return data!.map((r) => r.title.slice(-1));
    };
    const initial = await order(); // eşit sort: id sırası
    const target = initial[1];
    const up = await dan.rpc("reorder_announcements", { p_id: idOf(target), p_dir: -1 });
    expect(up.error).toBeNull();
    expect(up.data).toBe(true);
    expect(await order()).toEqual([initial[1], initial[0], initial[2]]);
    const down = await dan.rpc("reorder_announcements", { p_id: idOf(initial[1]), p_dir: 1 });
    expect(down.error).toBeNull();
    expect(await order()).toEqual([initial[0], initial[1], initial[2]]);
    // sınırda no-op
    expect((await dan.rpc("reorder_announcements", { p_id: idOf(initial[0]), p_dir: -1 })).data).toBe(true);
    expect(await order()).toEqual(initial);
    // olmayan kimlik
    expect((await dan.rpc("reorder_announcements", { p_id: "00000000-0000-4000-8000-000000000999", p_dir: 1 })).data).toBe(false);
    // editör olmayan (yönetici bayrağı kapalı) ve anon
    const denied = await yon.rpc("reorder_announcements", { p_id: idOf("a"), p_dir: 1 });
    expect(denied.error?.code).toBe("42501");
    const anonRes = await anon.rpc("reorder_announcements", { p_id: idOf("a"), p_dir: 1 });
    expect(anonRes.error).not.toBeNull();
    expect(await order()).toEqual(initial);
    await admin.from("announcements").delete().like("title", "test ord%");
  });
});
