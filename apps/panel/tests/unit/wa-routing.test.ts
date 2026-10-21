import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_LABELS } from "@/lib/constants";
import { WA_HEDEF_TURLERI, chatIdFor, hedefFor } from "@/lib/wa/routing";

const PANEL = path.resolve(__dirname, "../..");

/** Gruba yazılmayan olaylar (0013 trigger'ı kuyruğa almaz). */
const KUYRUGA_GIRMEYEN = new Set(["seed_import"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Kodda yazılan ya da biçimlenen tüm olay türleri: yeni bir tür eklenince bu liste büyür. */
function bilinenTurler(): Set<string> {
  const types = new Set<string>(Object.keys(EVENT_LABELS));
  const format = readFileSync(path.join(PANEL, "lib/wa/format.ts"), "utf8");
  // Yalnız describe() içindeki olay türü dalları; subjectKey'deki varlık türleri değil.
  const describeBody = format.slice(format.indexOf("function describe("), format.indexOf("function header("));
  expect(describeBody.length).toBeGreaterThan(100);
  for (const m of describeBody.matchAll(/case "([a-z_]+)":/g)) types.add(m[1]);
  for (const m of format.matchAll(/BATCH_EVENTS = new Set\(\[([^\]]*)\]/g)) {
    for (const t of m[1].matchAll(/"([a-z_]+)"/g)) types.add(t[1]);
  }
  for (const dir of ["actions", "lib", "app"]) {
    for (const file of walk(path.join(PANEL, dir))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/(?:eventType|event_type)\s*:\s*"([a-z_]+)"/g)) types.add(m[1]);
    }
  }
  for (const t of KUYRUGA_GIRMEYEN) types.delete(t);
  return types;
}

describe("WhatsApp grup yönlendirmesi", () => {
  it("koddaki her olay türü tam olarak bir gruba atanmış", () => {
    const finans = new Set(WA_HEDEF_TURLERI.finans);
    const kayit = new Set(WA_HEDEF_TURLERI.kayit);
    const ikisinde = [...finans].filter((t) => kayit.has(t));
    expect(ikisinde).toEqual([]);
    const atanmamis = [...bilinenTurler()].filter((t) => !finans.has(t) && !kayit.has(t)).sort();
    expect(atanmamis, "Yeni olay türünü lib/wa/routing.ts'te bir gruba ekleyin").toEqual([]);
  });

  it("ödeme ve fatura türleri ödeme grubuna gider", () => {
    for (const t of [
      "plan_olusturuldu", "taksit_odendi", "odeme_alindi", "odeme_geri_alindi", "odeme_hatirlatildi",
      "odeme_gunu_degisti", "iade_kaydedildi", "fiyat_listesi_guncellendi",
    ]) {
      expect(hedefFor(t), t).toBe("finans");
    }
    // İleride eklenecek fatura olayları ayrıca listelenmeden ödeme grubuna düşer.
    expect(hedefFor("fatura_kesildi")).toBe("finans");
  });

  it("kayıt süreci türleri ana grupta kalır", () => {
    for (const t of [
      "lead_olusturuldu", "web_basvuru", "web_tekrar_basvuru", "durum_degisti", "not_eklendi",
      "randevu_olusturuldu", "randevu_sonuclandi", "teklif_olusturuldu", "teklif_onaylandi",
      "teklif_reddedildi", "teklif_revize_edildi", "ogrenciye_donusturuldu", "ogrenci_ayrildi",
    ]) {
      expect(hedefFor(t), t).toBe("kayit");
    }
  });

  it("bilinmeyen tür ana gruba gider", () => {
    expect(hedefFor("bilinmeyen_tur")).toBe("kayit");
  });

  it("ödeme grubu seçili değilse ödeme mesajı ana gruba düşer", () => {
    expect(chatIdFor("taksit_odendi", { groupId: "ana@g.us", finansGroupId: "" })).toBe("ana@g.us");
    expect(chatIdFor("taksit_odendi", { groupId: "ana@g.us" })).toBe("ana@g.us");
    expect(chatIdFor("taksit_odendi", { groupId: "ana@g.us", finansGroupId: "odeme@g.us" })).toBe("odeme@g.us");
    expect(chatIdFor("lead_olusturuldu", { groupId: "ana@g.us", finansGroupId: "odeme@g.us" })).toBe("ana@g.us");
  });
});
