// Takip sırası ve ziyaret görevleri kuralları (saf modül).
import {
  addDaysToDateString,
  type BusinessHours,
  DEFAULT_BUSINESS_HOURS,
  isBusinessDay,
  istanbulAt,
  istanbulDateString,
  nextBusinessMoment,
} from "./business-hours";

export type PlannedTask = {
  ruleKey: string;
  title: string;
  dueAt: Date;
  kind: "arama" | "whatsapp";
  templateKey?: string;
};

export const FOLLOWUP_STEPS = 5;

const HOUR_MS = 60 * 60 * 1000;
const MAX_SHIFT = 14;

/** Günü mesai günü olana dek ileri (dir=1) ya da geri (dir=-1) kaydırır; saat korunur. */
function businessDayAt(dateString: string, hhmm: string, hours: BusinessHours, dir: 1 | -1): Date {
  let d = dateString;
  for (let i = 0; i < MAX_SHIFT && !isBusinessDay(d, hours); i++) {
    d = addDaysToDateString(d, dir);
  }
  return istanbulAt(d, hhmm);
}

/**
 * Başarısız `attempt`. denemeden sonraki takip görevi; sıra bittiyse null.
 * Gün sayımı firstAttemptAt'in İstanbul takvim gününe göre yapılır.
 */
export function followupAfterAttempt(
  leadId: string,
  leadName: string,
  attempt: number,
  attemptAt: Date,
  firstAttemptAt: Date,
  hours: BusinessHours,
): PlannedTask | null {
  if (attempt < 1 || attempt > FOLLOWUP_STEPS) return null;
  const next = attempt + 1;
  const day0 = istanbulDateString(firstAttemptAt);
  const ruleKey = `takip:${leadId}:${next}`;
  const title = `${next}. deneme · ${leadName}`;
  // Görev, denemenin kendisinden (+3 saat, mesaiye kaydırılmış) önceye düşmez.
  const floor = nextBusinessMoment(new Date(attemptAt.getTime() + 3 * HOUR_MS), hours);
  const at = (offset: number, hhmm: string) => {
    const due = businessDayAt(addDaysToDateString(day0, offset), hhmm, hours, 1);
    return due.getTime() < floor.getTime() ? floor : due;
  };

  switch (attempt) {
    case 1:
      return {
        ruleKey,
        title,
        kind: "arama",
        dueAt: nextBusinessMoment(new Date(attemptAt.getTime() + 3 * HOUR_MS), hours),
      };
    case 2:
      return { ruleKey, title, kind: "arama", dueAt: at(1, "10:00") };
    case 3:
      return { ruleKey, title, kind: "arama", dueAt: at(1, "18:30") };
    case 4:
      return { ruleKey, title, kind: "arama", dueAt: at(2, "10:00"), templateKey: "ziyaret_saatleri" };
    default:
      return { ruleKey, title: `Son deneme · ${leadName}`, kind: "arama", dueAt: at(6, "10:00") };
  }
}

/** Randevu hatırlatmaları; `now`'dan önce kalanlar atlanır. */
export function appointmentTasks(
  apptId: string,
  leadName: string,
  scheduledAt: Date,
  now: Date,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
): PlannedTask[] {
  const day = istanbulDateString(scheduledAt);
  const title = `Ziyaret hatırlatması · ${leadName}`;
  const tasks: PlannedTask[] = [
    {
      ruleKey: `hatirlat:${apptId}:once`,
      title,
      kind: "whatsapp",
      templateKey: "randevu_onay",
      // Hatırlatma ziyaretten önce gelmeli: mesai günü değilse geriye çekilir.
      dueAt: businessDayAt(addDaysToDateString(day, -1), "10:00", hours, -1),
    },
    {
      ruleKey: `hatirlat:${apptId}:sabah`,
      title,
      kind: "whatsapp",
      templateKey: "randevu_onay",
      dueAt: istanbulAt(day, "09:00"),
    },
  ];
  return tasks.filter((t) => t.dueAt.getTime() >= now.getTime());
}

/** "Geldi" sonrası: +1 gün teşekkür, +2 gün arama, +7 gün son arama. */
export function afterVisitTasks(
  apptId: string,
  leadName: string,
  visitedAt: Date,
  hours: BusinessHours,
): PlannedTask[] {
  const day = istanbulDateString(visitedAt);
  const at = (offset: number) => businessDayAt(addDaysToDateString(day, offset), "10:00", hours, 1);
  return [
    {
      ruleKey: `ziyaret:${apptId}:1`,
      title: `Teşekkür mesajı · ${leadName}`,
      kind: "whatsapp",
      templateKey: "ziyaret_tesekkur",
      dueAt: at(1),
    },
    { ruleKey: `ziyaret:${apptId}:2`, title: `Ziyaret sonrası arama · ${leadName}`, kind: "arama", dueAt: at(2) },
    { ruleKey: `ziyaret:${apptId}:3`, title: `Ziyaret sonrası arama · ${leadName}`, kind: "arama", dueAt: at(7) },
  ];
}

/** "Gelmedi": aynı gün (mesai içindeyse hemen) tekrar arama. */
export function noShowTask(apptId: string, leadName: string, now: Date, hours: BusinessHours): PlannedTask {
  return {
    ruleKey: `noshow:${apptId}`,
    title: `Gelmedi · tekrar ara · ${leadName}`,
    kind: "arama",
    dueAt: nextBusinessMoment(now, hours),
  };
}
