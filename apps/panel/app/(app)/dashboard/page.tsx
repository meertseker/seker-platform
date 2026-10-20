import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PeriodPicker } from "@/components/report/period-picker";
import { downloadHref } from "@/components/report/report-ui";
import {
  AutomationView,
  ContentView,
  FrontOfficeView,
  FunnelView,
  LostView,
  OffersView,
  SiteView,
  SourcesView,
  StudentsView,
  SummaryView,
} from "@/components/report/sections";
import { requireRole } from "@/lib/auth";
import { SECTION_TITLES, sectionTables, type Report } from "@/lib/report/build";
import { loadReport } from "@/lib/report/load";
import { periodQuery, resolvePeriod } from "@/lib/report/period";
import { createServerSupabase } from "@/lib/supabase/server";
import { requestClock } from "@/lib/time";

export const metadata: Metadata = { title: "Rapor" };

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireRole("yonetici", "danisman");
  const params = await searchParams;
  const { now, today } = await requestClock();
  const period = resolvePeriod(params, today);
  const query = periodQuery(period);
  const isManager = profile.role === "yonetici";

  let report: Report | null = null;
  try {
    const supabase = await createServerSupabase();
    report = await loadReport(supabase, { period, now, viewer: { id: profile.id, role: profile.role } });
  } catch (error) {
    console.error("[rapor] okunamadı:", error instanceof Error ? error.message : "bilinmeyen");
  }

  const sections = report ? sectionTables(report) : [];

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1180px] flex-col gap-8">
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-muted-foreground">{period.label} · karşılaştırma {period.prev.label}</p>
            <h1 className="text-[32px] font-bold tracking-tight text-foreground">Rapor</h1>
          </div>
          {report ? (
            <a
              href={downloadHref(query, "tum", "xlsx")}
              download
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-surface hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Download aria-hidden className="size-4" />
              Tüm raporu indir (Excel)
            </a>
          ) : null}
        </div>

        <PeriodPicker period={period} today={today} />

        {report ? (
          <p className="max-w-[60ch] text-[22px] font-semibold leading-snug tracking-tight text-foreground sm:text-[26px]">
            {report.summary.headline}
          </p>
        ) : null}

        {sections.length > 0 ? (
          <nav aria-label="Bölümler" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex w-max gap-1.5 text-[13px] font-semibold sm:w-auto sm:flex-wrap">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-3.5 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {s.id === "ogrenciler" && !isManager ? "Öğrenciler" : SECTION_TITLES[s.id]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      {report ? (
        <>
          <SummaryView s={report.summary} query={query} />
          <FunnelView f={report.funnel} query={query} />
          <SourcesView s={report.sources} query={query} manager={isManager} />
          <FrontOfficeView f={report.frontOffice} query={query} />
          <LostView l={report.lost} query={query} />
          {report.offers ? <OffersView o={report.offers} query={query} /> : null}
          <StudentsView s={report.students} query={query} />
          {report.content ? <ContentView c={report.content} query={query} /> : null}
          {report.site ? <SiteView s={report.site} query={query} /> : null}
          {report.automation ? <AutomationView a={report.automation} query={query} /> : null}
        </>
      ) : (
        <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive-soft p-5 text-sm text-foreground">
          Rapor verileri şu an okunamadı. Sayfayı yenileyin; sorun sürerse birkaç dakika sonra tekrar deneyin.
        </p>
      )}
    </div>
  );
}
