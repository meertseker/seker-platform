// Rapor bölümleri. Her bölüm aynı ReportTable'ları gösterir; grafikler tablodaki sayıların görsel özetidir.
import type {
  AutomationSection,
  ContentSection,
  FrontOfficeSection,
  FunnelSection,
  LostSection,
  OffersSection,
  SiteSection,
  SourcesSection,
  StudentsSection,
  SummarySection,
} from "@/lib/report/build";
import { formatDays, formatInt, formatPct, formatTl } from "@/lib/report/format";
import { change } from "@/lib/report/metrics";
import { formatMonth, formatMonthShort } from "@/lib/report/period";
import { ColumnChart } from "./column-chart";
import { BarRow, Card, CardTitle, DataTable, DeltaBadge, EmptyState, KpiTile, Legend, Section, StatTile } from "./report-ui";

function TableToggle({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary-strong hover:underline">
        {label}
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

// ---- Özet ----

export function SummaryView({ s, query }: { s: SummarySection; query: string }) {
  const [leads, won] = s.trend.series;
  const any = leads.values.some((v) => v > 0) || won.values.some((v) => v > 0);
  return (
    <Section id="ozet" title="Özet" question="Dönemin anahtar sayıları ve önceki döneme göre değişim." query={query}>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {s.kpis.map((k) => (
          <KpiTile key={k.key} kpi={k} />
        ))}
      </div>
      <Card>
        <CardTitle hint="Her ay panele düşen veli ve o ay kayıt olan veli. Seçili dönemden bağımsız, son 12 ay.">
          Son 12 ay
        </CardTitle>
        {any ? (
          <ColumnChart
            title="Son 12 ay: aylık yeni aday ve yeni kayıt"
            months={s.trend.months}
            monthLabels={s.trend.months.map(formatMonth)}
            shortLabels={s.trend.months.map(formatMonthShort)}
            series={[
              { label: leads.label, values: leads.values },
              { label: won.label, values: won.values },
            ]}
            mode="grouped"
            kind="int"
          />
        ) : (
          <EmptyState>Son 12 ayda panele düşen veli yok.</EmptyState>
        )}
        <TableToggle label="Ay ay sayıları göster">
          <DataTable table={s.tables[1]} />
        </TableToggle>
      </Card>
    </Section>
  );
}

// ---- Huni ----

export function FunnelView({ f, query }: { f: FunnelSection; query: string }) {
  return (
    <Section
      id="huni"
      title="Aday hunisi"
      question="Dönemde gelen veliler bugün hangi aşamada ve nerede takılıyor?"
      query={query}
      links={[{ href: "/pipeline", label: "Veliler ekranı" }]}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle hint="Her veli ulaştığı en ileri aşamada ve öncekilerin hepsinde sayılır. Çizgi önceki dönemin sayısı. En büyük düşüş kırmızı.">
            {f.total > 0 ? `Gelen ${formatInt(f.total)} veli` : "Gelen veli"}
          </CardTitle>
          {f.total === 0 ? (
            <EmptyState>Bu dönemde gelen veli yok. Dönemi değiştirerek önceki ayları görebilirsiniz.</EmptyState>
          ) : (
            <ol className="space-y-3">
              {f.steps.map((step, i) => (
                <li key={step.label}>
                  <BarRow
                    label={step.label}
                    value={step.n}
                    max={f.total}
                    marker={step.prevN}
                    markerLabel={`önceki dönem ${formatInt(step.prevN)}`}
                    display={formatInt(step.n)}
                    tone={step.worst ? "bad" : "series"}
                    sub={
                      i === 0
                        ? `önceki dönem ${formatInt(step.prevN)}`
                        : [
                            `gelenlere oranı ${formatPct(step.ofTotal)}`,
                            `önceki adımdan ${formatPct(step.fromPrev)} geçti`,
                            step.medianDaysFromPrev !== null ? `ortanca ${formatDays(step.medianDaysFromPrev)}` : null,
                            step.worst ? "en büyük düşüş" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                    }
                  />
                </li>
              ))}
            </ol>
          )}
          <TableToggle label="Huni tablosunu göster">
            <DataTable table={f.tables[0]} />
          </TableToggle>
        </Card>
        <Card>
          <CardTitle hint="Bugün kapanmamış bütün veliler (dönemden bağımsız). 7 günden uzun dokunulmayanlar ayrıca sayılır.">
            Şu an açık {formatInt(f.openTotal)} veli
          </CardTitle>
          {f.openTotal === 0 ? (
            <EmptyState>Açık veli yok.</EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {f.open.map((o) => (
                <li key={o.status}>
                  <BarRow
                    label={o.label}
                    value={o.n}
                    max={Math.max(...f.open.map((x) => x.n))}
                    display={formatInt(o.n)}
                    tone="soft"
                    sub={o.stale > 0 ? `${formatInt(o.stale)} veli 7 günden uzun bekliyor` : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
          {f.staleTotal > 0 ? (
            <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-[13px] text-foreground">
              <b>{formatInt(f.staleTotal)} veli</b> bir haftadan uzun süredir aranmadı ya da not almadı.
            </p>
          ) : null}
        </Card>
      </div>
    </Section>
  );
}

// ---- Kaynaklar ve reklam ----

export function SourcesView({ s, query, manager }: { s: SourcesSection; query: string; manager: boolean }) {
  const [sourceTable, ...rest] = s.tables;
  const platformTable = rest.find((t) => t.id === "reklam-platform");
  const campaignTable = rest.find((t) => t.id === "kampanyalar");
  const keywordTable = rest.find((t) => t.id === "kelimeler");
  return (
    <Section
      id="kaynaklar"
      title="Kaynaklar ve reklam"
      question={manager ? "Veliler nereden geliyor, reklama verilen para kayda dönüyor mu?" : "Veliler nereden geliyor, hangisi kayda dönüyor?"}
      query={query}
      links={manager ? [{ href: "/reklam/kampanyalar", label: "Kampanyalar" }, { href: "/pazarlama", label: "Pazarlama" }] : undefined}
    >
      <Card>
        <CardTitle hint="Dönemde gelen veliler, geldikleri yere göre. Kayıt oranı = kayıt olan ÷ gelen.">Kaynak başına veli</CardTitle>
        <DataTable table={sourceTable} barKey="aday" />
      </Card>

      {manager ? (
        <>
          {s.adNote ? (
            <p role="note" className="rounded-2xl border border-border bg-warning-soft px-4 py-3 text-sm text-foreground">
              {s.adNote}
            </p>
          ) : null}
          {s.hasAdData ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {s.platforms.map((p) => (
                  <div key={p.key} className="contents">
                    <StatTile label={`${p.label} harcaması`} value={formatTl(p.spendKurus)} helper={`${formatInt(p.leads)} aday · ${formatInt(p.kayit)} kayıt`} />
                    <StatTile
                      label={`${p.label} · kayıt başı`}
                      value={formatTl(p.costPerKayit)}
                      helper={`aday başı ${formatTl(p.costPerLead)}`}
                    />
                  </div>
                ))}
              </div>
              {platformTable ? (
                <Card>
                  <CardTitle hint="Harcama reklam platformunun günlük raporundan; aday ve kayıt panelden. Kayıt başı = harcama ÷ dönemde gelip kayıt olan reklam velisi.">
                    Harcama ve maliyet
                  </CardTitle>
                  <DataTable table={platformTable} />
                </Card>
              ) : null}
              {campaignTable ? (
                <Card>
                  <CardTitle hint="Pazarlama ekranıyla aynı hesap.">Kampanya başına</CardTitle>
                  <DataTable table={campaignTable} barKey="aday" />
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      ) : s.adNote ? (
        <EmptyState>{s.adNote}</EmptyState>
      ) : null}

      {keywordTable && (keywordTable.rows.length > 0 || manager) ? (
        <Card>
          <CardTitle hint="Reklamdan gelen velinin aradığı kelime (formdaki utm_term). Benzer yazımlar birleştirilir.">
            Arama kelimesi başına
          </CardTitle>
          <DataTable table={{ ...keywordTable, rows: keywordTable.rows.slice(0, 25) }} barKey="aday" />
          {keywordTable.rows.length > 25 ? (
            <p className="mt-2 text-[13px] text-muted-foreground">
              İlk 25 kelime gösteriliyor; {formatInt(keywordTable.rows.length)} kelimenin hepsi Excel dosyasında.
            </p>
          ) : null}
        </Card>
      ) : null}
    </Section>
  );
}

// ---- Ön büro ----

export function FrontOfficeView({ f, query }: { f: FrontOfficeSection; query: string }) {
  return (
    <Section
      id="on-buro"
      title="Ön büro"
      question={f.ownOnly ? "Velilerime ne kadar hızlı dönüyorum, okul ortalamasına göre neredeyim?" : "Danışmanlar veliye ne kadar hızlı dönüyor, randevuya ne kadarı geliyor?"}
      query={query}
      links={f.ownOnly ? undefined : [{ href: "/reklam/hafta", label: "Bu hafta" }]}
    >
      <Card>
        <CardTitle hint="İlk arama: veli düştükten ilk aramaya kadar geçen mesai süresi; hiç aranmayan veli bugüne kadar beklediğiyle sayılır. 7 günde ulaşma yalnız 7 günü dolmuş velilerde. Randevuya gelme: randevusu dönemde olanlardan gelen ÷ (gelen + gelmeyen). Görevler bugünkü durum.">
          {f.ownOnly ? "Benim sayılarım" : "Kişi başına"}
        </CardTitle>
        <DataTable table={f.tables[0]} />
      </Card>
    </Section>
  );
}

// ---- Kayıp ----

export function LostView({ l, query }: { l: LostSection; query: string }) {
  const max = Math.max(1, ...l.bars.map((b) => Math.max(b.n, b.prevN)));
  return (
    <Section id="kayip" title="Kayıp nedenleri" question="Dönemde kaybedilen veliler neden vazgeçti?" query={query}>
      <Card>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">Dönemde kaybedilen {formatInt(l.total)} veli</h3>
          <DeltaBadge change={change(l.total, l.prevTotal)} goodWhen="down" />
        </div>
        {l.bars.length === 0 || l.total + l.prevTotal === 0 ? (
          <EmptyState>Bu dönemde ve önceki dönemde kaybedilen veli yok.</EmptyState>
        ) : (
          <>
            <ul className="space-y-2.5">
              {l.bars.map((b) => (
                <li key={b.label}>
                  <BarRow
                    label={b.label}
                    value={b.n}
                    max={max}
                    marker={b.prevN}
                    markerLabel={`önceki dönem ${formatInt(b.prevN)}`}
                    display={formatInt(b.n)}
                    sub={`önceki dönem ${formatInt(b.prevN)}`}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Legend
                items={[
                  { label: "Bu dönem", swatch: "size-2.5 rounded-[3px] bg-chart-1" },
                  { label: "Önceki dönem", swatch: "h-3 w-0.5 rounded-full bg-foreground/70" },
                ]}
              />
            </div>
          </>
        )}
      </Card>
    </Section>
  );
}

// ---- Teklifler ----

export function OffersView({ o, query }: { o: OffersSection; query: string }) {
  return (
    <Section
      id="teklifler"
      title="Teklifler"
      question="Kaç teklif verdik, ne kadar indirim yaptık?"
      query={query}
      links={[{ href: "/teklifler", label: "Teklifler ekranı" }]}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Verilen teklif" value={formatInt(o.created)} helper="dönemde" />
        <StatTile label="Onaylanan" value={formatInt(o.approved)} helper={`onay oranı ${formatPct(o.created ? o.approved / o.created : null)}`} />
        <StatTile label="Ortalama indirim" value={formatPct(o.avgDiscount)} helper="liste fiyatına göre" />
        <StatTile label="Onay bekleyen" value={formatInt(o.pending)} helper="bugün" tone={o.pending > 0 ? "bad" : "neutral"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle hint="Dönemde verilen tekliflerin bugün hangi durumda olduğu.">Durum dağılımı</CardTitle>
          <DataTable table={o.tables[0]} />
        </Card>
        <Card>
          <CardTitle>Teklifi veren</CardTitle>
          <DataTable table={o.tables[1]} />
        </Card>
      </div>
    </Section>
  );
}

// ---- Öğrenciler ve tahsilat ----

export function StudentsView({ s, query }: { s: StudentsSection; query: string }) {
  const m = s.money;
  const programMax = Math.max(1, ...s.programs.map((p) => Math.max(p.active, p.capacity ?? 0)));
  return (
    <Section
      id="ogrenciler"
      title={m ? "Öğrenciler ve tahsilat" : "Öğrenciler"}
      question={m ? "Kaç öğrencimiz var, aidat ne kadar gelmeli, ne kadar geldi, kim gecikti?" : "Kaç öğrencimiz var, hangi programda?"}
      query={query}
      links={m ? [{ href: "/odemeler", label: "Ödemeler" }, { href: "/odemeler/gecikenler", label: "Gecikenler" }] : [{ href: "/ogrenciler", label: "Öğrenciler" }]}
    >
      <div className={`grid gap-4 ${m ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" : ""}`}>
        <Card>
          <CardTitle hint={`Bugün aktif ${formatInt(s.active)} öğrenci. Çizgi aktif fiyat listesindeki kontenjan. Dönemde ayrılan: ${formatInt(s.left)}.`}>
            Program ve doluluk
          </CardTitle>
          {s.programs.length === 0 ? (
            <EmptyState>Aktif öğrenci yok.</EmptyState>
          ) : (
            <ul className="space-y-2.5">
              {s.programs.map((p) => (
                <li key={p.program}>
                  <BarRow
                    label={p.label}
                    value={p.active}
                    max={programMax}
                    marker={p.capacity ?? undefined}
                    markerLabel={p.capacity !== null ? `kontenjan ${formatInt(p.capacity)}` : undefined}
                    display={formatInt(p.active)}
                    sub={p.capacity ? `kontenjan ${formatInt(p.capacity)} · doluluk ${formatPct(p.active / p.capacity)}` : "kontenjan girilmemiş"}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {m ? (
          <div className="grid min-w-0 grid-cols-2 content-start gap-3">
            <StatTile label="Vadesi gelen" value={formatTl(m.expectedKurus)} helper="dönemde, iptal hariç" />
            <StatTile
              label="Tahsil edilen"
              value={formatTl(m.collectedKurus)}
              helper={`vadesi gelenden ödenen ${formatPct(m.dueCollectedRatio)}`}
            />
            <StatTile
              label="Geciken (bugün)"
              value={formatTl(m.overdueKurus)}
              helper={`${formatInt(m.overdueCount)} taksit`}
              tone={m.overdueKurus > 0 ? "bad" : "neutral"}
            />
            <StatTile label="İade" value={formatTl(m.refundsKurus)} helper="dönemde" />
          </div>
        ) : null}
      </div>

      {m ? (
        <>
          <Card>
            <CardTitle hint="Açık mavi o ay vadesi gelen tutar, koyu mavi o ay tahsil edilen. Koyu sütun açığa ulaşmıyorsa ay eksik kapandı.">
              Son 12 ay: beklenen ve tahsil edilen
            </CardTitle>
            <ColumnChart
              title="Son 12 ay: aylık vadesi gelen ve tahsil edilen tutar"
              months={m.trend.months}
              monthLabels={m.trend.months.map(formatMonth)}
              shortLabels={m.trend.months.map(formatMonthShort)}
              series={[
                { label: m.trend.series[0].label, values: m.trend.series[0].values },
                { label: m.trend.series[1].label, values: m.trend.series[1].values },
              ]}
              mode="overlay"
              kind="tl"
            />
            <TableToggle label="Ay ay tutarları göster">
              <DataTable table={s.tables.find((t) => t.id === "tahsilat-12-ay")!} />
            </TableToggle>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle hint="Kalem türüne göre dönemde vadesi gelen ve tahsil edilen; geciken bugünkü toplam.">Kalem başına</CardTitle>
              <DataTable table={s.tables.find((t) => t.id === "tahsilat")!} />
            </Card>
            <Card>
              <CardTitle hint="Ödenmemiş ve vadesi geçmiş taksitler, kaç gün geciktiğine göre.">Geciken taksitler</CardTitle>
              {m.overdueCount === 0 ? (
                <EmptyState>Geciken taksit yok.</EmptyState>
              ) : (
                <ul className="space-y-2.5">
                  {m.aging.map((a) => (
                    <li key={a.key}>
                      <BarRow
                        label={a.label}
                        value={a.amountKurus}
                        max={Math.max(...m.aging.map((x) => x.amountKurus))}
                        display={formatTl(a.amountKurus)}
                        tone="bad"
                        sub={`${formatInt(a.count)} taksit`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </Section>
  );
}

// ---- İçerik ----

export function ContentView({ c, query }: { c: ContentSection; query: string }) {
  return (
    <Section
      id="icerik"
      title="İçerik"
      question="Öğretmenler içerik görevlerini zamanında teslim ediyor mu?"
      query={query}
      links={[{ href: "/reklam/icerik", label: "İçerik panosu" }]}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Verilen görev" value={formatInt(c.given)} />
        <StatTile label="Teslim edilen" value={formatInt(c.submitted)} />
        <StatTile label="Onaylanan" value={formatInt(c.approved)} />
        <StatTile label="Zamanında teslim" value={formatPct(c.onTime)} />
        <StatTile label="Şu an geciken" value={formatInt(c.late)} tone={c.late > 0 ? "bad" : "neutral"} />
      </div>
      <Card>
        <CardTitle>Öğretmen başına</CardTitle>
        <DataTable table={c.tables[0]} />
      </Card>
    </Section>
  );
}

// ---- Site ----

export function SiteView({ s, query }: { s: SiteSection; query: string }) {
  const empty = s.current.visits === 0 && s.previous.visits === 0;
  return (
    <Section
      id="site"
      title="Site trafiği"
      question="Siteye kaç kişi geldi, nereden geldi, kaçı başvurdu?"
      query={query}
      links={[{ href: "/pazarlama", label: "Google Analytics ayrıntısı (Pazarlama)" }]}
    >
      {empty ? (
        <EmptyState>Bu dönemde sitenin ziyaret sayacı veri yazmadı.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex flex-col gap-0.5 rounded-xl bg-muted p-3.5">
              <span className="text-[13px] font-medium text-muted-foreground">Ziyaret</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">{formatInt(s.current.visits)}</span>
              <DeltaBadge change={change(s.current.visits, s.previous.visits)} goodWhen="up" />
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl bg-muted p-3.5">
              <span className="text-[13px] font-medium text-muted-foreground">Sayfa görüntüleme</span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">{formatInt(s.current.pageViews)}</span>
              <DeltaBadge change={change(s.current.pageViews, s.previous.pageViews)} goodWhen="up" />
            </div>
            <StatTile label="Telefondan" value={formatPct(s.current.mobileShare)} helper="ziyaretlerin" />
            <StatTile label="Siteden başvuru" value={formatInt(s.webLeads)} helper={`ziyarete oranı ${formatPct(s.conversion)}`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle hint="Çerezsiz sayaç; reklam izni vermeyen ziyaretçi de sayılır.">Ziyaretin geldiği yer</CardTitle>
              <DataTable table={s.tables[1]} barKey="ziyaret" />
            </Card>
            <Card>
              <CardTitle>En çok bakılan sayfalar</CardTitle>
              <DataTable table={s.tables[2]} />
            </Card>
          </div>
        </>
      )}
    </Section>
  );
}

// ---- Otomasyonlar ----

export function AutomationView({ a, query }: { a: AutomationSection; query: string }) {
  return (
    <Section
      id="otomasyon"
      title="Otomasyonlar"
      question="WhatsApp grup mesajları ve reklam platformuna bildirimler çalışıyor mu?"
      query={query}
      links={[{ href: "/ayarlar", label: "WhatsApp ayarları" }]}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Gruba giden mesaj" value={formatInt(a.waSent)} />
        <StatTile label="Gitmeyen mesaj" value={formatInt(a.waFailed)} tone={a.waFailed > 0 ? "bad" : "neutral"} />
        <StatTile label="Bildirilen dönüşüm" value={formatInt(a.uploadsSent)} helper={`${formatInt(a.uploadsPending)} sırada`} />
        <StatTile label="Hatalı bildirim" value={formatInt(a.uploadsFailed)} tone={a.uploadsFailed > 0 ? "bad" : "neutral"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>WhatsApp grup mesajları</CardTitle>
          <DataTable table={a.tables[0]} />
        </Card>
        <Card>
          <CardTitle>Reklam platformuna bildirimler</CardTitle>
          <DataTable table={a.tables[1]} />
        </Card>
      </div>
    </Section>
  );
}

