'use client';

import { useEffect, useState, useTransition } from 'react';
import { listRevisions, revertRevision, type RevisionRow } from '@/app/actions/content';
import { Drawer } from './Drawer';

export function HistoryDrawer({ onClose, onReverted, onError }: { onClose(): void; onReverted(): void; onError(msg: string): void }) {
  const [rows, setRows] = useState<RevisionRow[] | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => void listRevisions(50).then(setRows), []);
  return (
    <Drawer title="Değişiklik geçmişi" onClose={onClose}>
      {rows === null ? <p>Yükleniyor…</p> : rows.length === 0 ? <p>Henüz değişiklik yok.</p> : (
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
                const res = await revertRevision(r.id);
                if (res.ok) onReverted(); else onError(res.error);
              })}>Bu değişikliği geri al</button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
