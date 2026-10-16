import { describe, it, expect } from "vitest";
import {
  daysSince,
  elapsedText,
  nextStep,
  sheetForAction,
  type NextStepInput,
} from "@/lib/next-step";
import { addDaysToDateString, planCallOutcome } from "@/lib/call-outcome";

const NOW = "2026-10-16T09:00:00.000Z"; // İstanbul 12:00

function input(partial: Partial<NextStepInput> & { status?: NextStepInput["lead"]["status"] }): NextStepInput {
  return {
    lead: partial.lead ?? {
      status: partial.status ?? "yeni",
      converted_student_id: null,
      lost_reason: null,
    },
    appointments: partial.appointments ?? [],
    offers: partial.offers ?? [],
    now: partial.now ?? NOW,
  };
}

describe("nextStep", () => {
  it("kazanılan veli için öğrenci kaydını açar", () => {
    const step = nextStep(
      input({ lead: { status: "kazanildi", converted_student_id: "s1" } }),
    );
    expect(step.title).toBe("Kayıt tamamlandı");
    expect(step.action).toBe("open_student");
  });

  it("kaybedilen veli için nedeni yazar ve yeniden açmayı önerir", () => {
    const step = nextStep(
      input({ lead: { status: "kaybedildi", converted_student_id: null, lost_reason: "fiyat" } }),
    );
    expect(step.title).toBe("Kaybedildi");
    expect(step.hint).toContain("Fiyat");
    expect(step.action).toBe("reopen");
  });

  it("onaylı teklif varsa her açık durumda öğrenciye dönüştürmeyi önerir", () => {
    for (const status of ["ulasildi", "randevu", "gorusme_yapildi", "teklif"] as const) {
      const step = nextStep(input({ status, offers: [{ status: "onaylandi" }] }));
      expect(step.action).toBe("convert");
      expect(step.title).toBe("Öğrenciye dönüştür");
    }
  });

  it("geçmiş ama sonuçlanmamış randevu için sonuç girmeyi ister", () => {
    const step = nextStep(
      input({
        status: "randevu",
        appointments: [{ scheduled_at: "2026-10-15T08:00:00.000Z", outcome: "bekliyor" }],
      }),
    );
    expect(step.title).toBe("Ziyaret sonucunu gir");
    expect(step.action).toBe("appointment_result");
  });

  it("sonuçlanmış geçmiş randevuyu dikkate almaz", () => {
    const step = nextStep(
      input({
        status: "gorusme_yapildi",
        appointments: [{ scheduled_at: "2026-10-15T08:00:00.000Z", outcome: "geldi" }],
      }),
    );
    expect(step.action).toBe("offer");
  });

  it("yeni veli için ilk aramayı ister", () => {
    const step = nextStep(input({ status: "yeni" }));
    expect(step.title).toBe("İlk aramayı yap");
    expect(step.action).toBe("call");
  });

  it("ulaşılan veli için randevu ister", () => {
    expect(nextStep(input({ status: "ulasildi" })).action).toBe("appointment");
  });

  it("randevulu velide gelecek randevu varsa bekler ve saati İstanbul saatiyle yazar", () => {
    const step = nextStep(
      input({
        status: "randevu",
        appointments: [{ scheduled_at: "2026-10-17T11:30:00.000Z", outcome: "bekliyor" }],
      }),
    );
    expect(step.title).toBe("Ziyaret bekleniyor");
    expect(step.action).toBeNull();
    expect(step.hint).toContain("17 Ekim");
    expect(step.hint).toContain("14:30");
  });

  it("randevulu velide bekleyen randevu yoksa yeni randevu ister", () => {
    const step = nextStep(
      input({
        status: "randevu",
        appointments: [{ scheduled_at: "2026-10-17T11:30:00.000Z", outcome: "iptal" }],
      }),
    );
    expect(step.title).toBe("Randevu ver");
    expect(step.action).toBe("appointment");
  });

  it("görüşme yapılan veli için teklif ister", () => {
    expect(nextStep(input({ status: "gorusme_yapildi" })).title).toBe("Teklif hazırla");
  });

  it("onay bekleyen teklif varken bekler", () => {
    const step = nextStep(input({ status: "teklif", offers: [{ status: "onay_bekliyor" }] }));
    expect(step.title).toBe("Yönetici onayı bekleniyor");
    expect(step.action).toBeNull();
  });

  it("kullanılmamış karşı rakam varsa karşı teklif ister", () => {
    const step = nextStep(
      input({
        status: "teklif",
        offers: [{ status: "revize_edildi", counter_price: 18000, superseded_by_offer_id: null }],
      }),
    );
    expect(step.title).toBe("Karşı rakamla teklif oluştur");
    expect(step.action).toBe("counter_offer");
    expect(step.hint).toContain("18.000,00 ₺");
  });

  it("kullanılmış karşı rakamı ve reddedilen teklifi saymaz", () => {
    const step = nextStep(
      input({
        status: "teklif",
        offers: [
          { status: "revize_edildi", counter_price: 18000, superseded_by_offer_id: "o2" },
          { status: "reddedildi" },
        ],
      }),
    );
    expect(step.title).toBe("Teklif hazırla");
    expect(step.action).toBe("offer");
  });

  it("beklemedeki veli için sezon araması önerir", () => {
    const step = nextStep(input({ status: "beklemede" }));
    expect(step.title).toBe("Sezon yaklaşınca ara");
    expect(step.action).toBe("call");
  });
});

describe("sheetForAction", () => {
  it("aksiyonu sayfa içi forma eşler", () => {
    expect(sheetForAction("appointment")).toBe("randevu");
    expect(sheetForAction("offer")).toBe("teklif");
    expect(sheetForAction("convert")).toBe("kayit");
    expect(sheetForAction("appointment_result")).toBe("sonuc");
    expect(sheetForAction("call")).toBeNull();
    expect(sheetForAction(null)).toBeNull();
  });
});

describe("daysSince / elapsedText", () => {
  it("tam gün sayısını verir, geleceği 0 sayar", () => {
    expect(daysSince("2026-10-12T09:00:00.000Z", NOW)).toBe(4);
    expect(daysSince("2026-10-15T10:00:00.000Z", NOW)).toBe(0);
    expect(daysSince("2026-10-20T10:00:00.000Z", NOW)).toBe(0);
    expect(daysSince("2026-10-12T09:00:00.000Z", new Date(NOW))).toBe(4);
  });

  it("geçen süreyi dakika/saat/gün olarak yazar", () => {
    expect(elapsedText("2026-10-16T08:55:00.000Z", NOW)).toBe("5 dk önce");
    expect(elapsedText("2026-10-16T06:00:00.000Z", NOW)).toBe("3 sa önce");
    expect(elapsedText("2026-10-14T09:00:00.000Z", NOW)).toBe("2 gün önce");
    expect(elapsedText(NOW, NOW)).toBe("az önce");
  });
});

describe("planCallOutcome", () => {
  it("ulaşıldığında yeni veliyi ulaşıldıya alır ve randevuya yönlendirir", () => {
    const plan = planCallOutcome({ outcome: "ulastim", next: "randevu", status: "yeni" });
    expect(plan.note).toBe("Arandı, ulaşıldı.");
    expect(plan.status).toEqual({ to: "ulasildi" });
    expect(plan.task).toBeNull();
    expect(plan.redirectToAppointment).toBe(true);
  });

  it("ulaşıldığında yeni olmayan velinin durumunu değiştirmez, notu kullanır", () => {
    const plan = planCallOutcome({ outcome: "ulastim", next: "fiyat", status: "randevu", note: " Fiyat istedi " });
    expect(plan.note).toBe("Fiyat istedi");
    expect(plan.status).toBeNull();
    expect(plan.task).toEqual({ title: "Fiyat bilgisini gönder", dueInDays: 0 });
    expect(plan.redirectToAppointment).toBe(false);
  });

  it("sonra ara seçilirse yarına görev açar", () => {
    const plan = planCallOutcome({ outcome: "ulastim", next: "sonra", status: "ulasildi" });
    expect(plan.task).toEqual({ title: "Tekrar ara", dueInDays: 1 });
  });

  it("açmadığında bugüne tekrar ara görevi açar, durumu değiştirmez", () => {
    const plan = planCallOutcome({ outcome: "acmadi", status: "yeni", note: "meşgul" });
    expect(plan.note).toBe("Arandı, açmadı. meşgul");
    expect(plan.status).toBeNull();
    expect(plan.task).toEqual({ title: "Tekrar ara", dueInDays: 0 });
  });

  it("yanlış numarada veliyi ulaşılamadı nedeniyle kaybedildi yapar", () => {
    const plan = planCallOutcome({ outcome: "yanlis", status: "ulasildi" });
    expect(plan.note).toBe("Yanlış numara.");
    expect(plan.status).toEqual({ to: "kaybedildi", lostReason: "ulasilamadi" });
    expect(plan.task).toBeNull();
  });

  it("zaten kaybedilmiş velide durumu tekrar değiştirmez", () => {
    expect(planCallOutcome({ outcome: "yanlis", status: "kaybedildi" }).status).toBeNull();
  });
});

describe("addDaysToDateString", () => {
  it("ay ve yıl sınırını geçer", () => {
    expect(addDaysToDateString("2026-10-16", 1)).toBe("2026-10-17");
    expect(addDaysToDateString("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateString("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateString("2026-10-16", 0)).toBe("2026-10-16");
  });
});
