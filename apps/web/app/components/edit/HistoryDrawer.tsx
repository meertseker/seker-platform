'use client';

import { useEffect, useState, useTransition } from 'react';
import { listRevisions, revertRevision, type RevisionRow } from '@/app/actions/content';
import { Drawer } from './Drawer';

const alertStyle = { color: '#b4234e', fontSize: 14 } as const;

export function HistoryDrawer({ onClose, onReverted, onError }: { onClose(): void; onReverted(): void; onError(msg: string): void }) {
  const [rows, setRows] = useState<RevisionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => {
    let alive = true;
    listRevisions(50).then(
      (res) => {
        if (!alive) return;
        if (res.ok) setRows(res.rows);
        else setLoadError(res.error);
      },
      () => alive && setLoadError('Geçmiş yüklenemedi, tekrar deneyin.'),
    );
    return () => {
      alive = false;
    };
  }, []);
  return (
    <Drawer title="Değişiklik geçmişi" onClose={onClose}>
      {revertError ? <p role="alert" style={alertStyle}>{revertError}</p> : null}
      {loadError ? (
        <p role="alert" style={alertStyle}>{loadError}</p>
      ) : rows === null ? (
        <p>Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p>Henüz değişiklik yok.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 10 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ borderBottom: '1px solid #e2d7f0', paddingBottom: 8 }}>
              <strong>{r.label}</strong>
              <div style={{ fontSize: 13, color: '#5f4f75' }}>
                {new Date(r.createdAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} · {r.editorName}
              </div>
              <div style={{ fontSize: 14 }}>Önce: {r.before}</div>
              <div style={{ fontSize: 14 }}>Sonra: {r.after}</div>
              <button type="button" disabled={busy} onClick={() => start(async () => {
                setRevertError(null);
                try {
                  const res = await revertRevision(r.id);
                  if (res.ok) return onReverted();
                  setRevertError(res.error);
                  onError(res.error);
                } catch {
                  const msg = 'Geri alınamadı, tekrar deneyin.';
                  setRevertError(msg);
                  onError(msg);
                }
              })}>Bu değişikliği geri al</button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
