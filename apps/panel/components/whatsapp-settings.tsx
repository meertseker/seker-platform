"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  disconnectWa,
  getWaConnection,
  listWaGroups,
  retryWaFailed,
  saveWaGroup,
  sendWaTest,
  setWaEnabled,
  startWaConnection,
  type WaConnection,
} from "@/actions/whatsapp";

export interface WaOutboxView {
  id: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  error: string | null;
  message: string | null;
}

interface Props {
  enabled: boolean;
  groupId: string;
  groupName: string;
  recent: WaOutboxView[];
  failedCount: number;
}

const primaryBtn =
  "min-h-11 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtn =
  "min-h-11 cursor-pointer rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const STATUS_TEXT: Record<string, string> = {
  WORKING: "Bağlı",
  SCAN_QR_CODE: "QR okutulmayı bekliyor",
  STARTING: "Başlatılıyor…",
  STOPPED: "Durduruldu",
  FAILED: "Bağlantı hatası",
  YOK: "Bağlı değil",
  HATA: "WhatsApp servisine ulaşılamıyor",
  PASSKEY_REQUIRED: "Telefonda onay bekleniyor",
  PASSKEY_CONFIRMATION_REQUIRED: "Telefonda onay bekleniyor",
};

const OUTBOX_TEXT: Record<string, string> = {
  bekliyor: "Sırada",
  gonderiliyor: "Gönderiliyor",
  gonderildi: "Gönderildi",
  hata: "Gönderilemedi",
  atlandi: "Atlandı",
};

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
});

export function WhatsappSettings({ enabled: initialEnabled, groupId, groupName, recent, failedCount }: Props) {
  const [conn, setConn] = useState<WaConnection | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState(groupId);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const refresh = useCallback(async () => {
    setConn(await getWaConnection());
  }, []);

  useEffect(() => {
    let alive = true;
    getWaConnection().then((c) => {
      if (alive) setConn(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  // QR 20 sn'de bir yenilenir; okutulana kadar durumu sık sorgula.
  const waiting = conn?.status === "SCAN_QR_CODE" || conn?.status === "STARTING";
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [waiting, refresh]);

  function run(task: () => Promise<{ error?: string } | void>, okText?: string) {
    setMessage(null);
    start(async () => {
      const res = await task();
      if (res && "error" in res && res.error) setMessage({ kind: "error", text: res.error });
      else if (okText) setMessage({ kind: "ok", text: okText });
    });
  }

  if (conn && !conn.configured) {
    return (
      <section id="whatsapp" className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-semibold text-foreground">WhatsApp grubu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          WhatsApp servisi bu sunucuda henüz kurulu değil (WAHA_URL ayarı boş).
        </p>
      </section>
    );
  }

  const connected = conn?.status === "WORKING";
  const selectedName = groups?.find((g) => g.id === selected)?.name ?? (selected === groupId ? groupName : "");

  return (
    <section id="whatsapp" className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold text-foreground">WhatsApp grubu</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Panelde yapılan her işlem (yeni veli, görüşme notu, randevu, teklif, ödeme, kayıt) seçilen gruba otomatik mesaj olarak gider.
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">1. Numarayı bağla</h3>
          <p className="mt-1 text-sm">
            Durum: <span className="font-semibold">{conn ? STATUS_TEXT[conn.status] ?? conn.status : "Kontrol ediliyor…"}</span>
            {connected && conn?.phone ? ` · ${conn.name ? `${conn.name} ` : ""}(${conn.phone})` : null}
          </p>
          {conn?.error ? <p className="mt-1 text-xs text-muted-foreground">{conn.error}</p> : null}

          {conn?.status === "SCAN_QR_CODE" && conn.qr ? (
            <div className="mt-3 flex flex-wrap items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- WAHA'dan gelen data URL */}
              <img src={conn.qr} alt="WhatsApp bağlama QR kodu" width={240} height={240} className="rounded-xl border border-border bg-white p-2" />
              <ol className="max-w-sm list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Telefonda WhatsApp Business&apos;ı açın.</li>
                <li>Ayarlar › Bağlı cihazlar › Cihaz bağla&apos;ya dokunun.</li>
                <li>Bu QR kodu okutun. Kod 20 saniyede bir yenilenir.</li>
              </ol>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {!connected && conn?.status !== "SCAN_QR_CODE" ? (
              <button type="button" className={primaryBtn} disabled={pending || !conn} onClick={() => run(async () => { setConn(await startWaConnection()); })}>
                Bağlan (QR göster)
              </button>
            ) : null}
            {connected ? (
              <button
                type="button"
                className={secondaryBtn}
                disabled={pending}
                onClick={() => run(async () => { const r = await disconnectWa(); setEnabled(false); await refresh(); return r; }, "Numaranın bağlantısı kesildi.")}
              >
                Bağlantıyı kes
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">2. Grubu seç</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Seçili grup: <span className="font-semibold text-foreground">{groupName || "yok"}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {groups ? (
              <select
                id="wa-group"
                aria-label="Bildirim grubu"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-surface px-3 py-2 text-sm"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Grup seçin…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className={secondaryBtn}
              disabled={pending || !connected}
              onClick={() => run(async () => { const r = await listWaGroups(); setGroups(r.groups); return r; })}
            >
              {groups ? "Listeyi yenile" : "Grupları getir"}
            </button>
            {groups ? (
              <button
                type="button"
                className={primaryBtn}
                disabled={pending || !selected || selected === groupId}
                onClick={() => run(() => saveWaGroup(selected, selectedName), "Grup kaydedildi.")}
              >
                Kaydet
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">3. Bildirimleri aç</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                id="wa-enabled"
                type="checkbox"
                checked={enabled}
                disabled={pending || (!enabled && (!groupId || !connected))}
                onChange={(e) => {
                  const next = e.target.checked;
                  run(async () => { const r = await setWaEnabled(next); if (!r.error) setEnabled(next); return r; }, next ? "Bildirimler açıldı." : "Bildirimler kapatıldı.");
                }}
              />
              Panel işlemlerini gruba gönder
            </label>
            <button type="button" className={secondaryBtn} disabled={pending || !connected || !groupId} onClick={() => run(sendWaTest, "Test mesajı gönderildi, gruba bakın.")}>
              Test mesajı gönder
            </button>
            {failedCount > 0 ? (
              <button type="button" className={secondaryBtn} disabled={pending || !connected} onClick={() => run(retryWaFailed, "Gönderilemeyen mesajlar yeniden sıraya alındı.")}>
                Gönderilemeyenleri tekrar dene ({failedCount})
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Kapalıyken yapılan işlemler gruba sonradan gönderilmez.
          </p>
        </div>

        {message ? (
          <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "rounded-xl bg-destructive-soft px-3 py-2 text-sm font-medium text-red-700" : "rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"}>
            {message.text}
          </p>
        ) : null}

        {recent.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-foreground">Son mesajlar</h3>
            <ul className="mt-2 divide-y divide-border rounded-2xl border border-border">
              {recent.map((r) => (
                <li key={r.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{OUTBOX_TEXT[r.status] ?? r.status}</span>
                    <time dateTime={r.sentAt ?? r.createdAt}>{timeFormatter.format(new Date(r.sentAt ?? r.createdAt))}</time>
                  </div>
                  {r.message ? <p className="whitespace-pre-wrap text-foreground">{r.message}</p> : null}
                  {r.error && r.status !== "gonderildi" ? <p className="text-xs text-muted-foreground">{r.error}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
