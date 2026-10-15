'use client';

import { useState } from 'react';
import type { ListItem, SlotMeta } from '@/lib/content/types';
import { countChars } from '@/lib/content/chars';
import { Drawer } from './Drawer';

function newId(existing: string[]): string {
  let id = '';
  do id = `m-${Math.random().toString(36).slice(2, 8)}`;
  while (existing.includes(id));
  return id;
}

export function ListPanel({ listKey, meta, value, onChange, onClose }: {
  listKey: string; meta: SlotMeta; value: ListItem[]; onChange(next: ListItem[]): void; onClose(): void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const fields = Object.entries(meta.fields ?? {});
  const max = meta.maxItems ?? 50;
  const fixed = Boolean(meta.fixedItems);
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = () => {
    const blank: ListItem = { id: newId(value.map((v) => v.id)) };
    for (const [name, f] of fields) blank[name] = f.kind === 'flag' ? false : f.kind === 'image' ? undefined : '';
    onChange([...value, { ...blank, ...meta.newItem, id: blank.id }]);
  };
  return (
    <Drawer title={meta.label} onClose={onClose}>
      <ol style={{ display: 'grid', gap: 12, padding: 0, listStyle: 'none' }} data-list-key={listKey}>
        {value.map((item, i) => (
          <li key={item.id} style={{ border: '1px solid #e2d7f0', borderRadius: 10, padding: 12 }}>
            {fields.map(([name, f]) =>
              f.kind === 'flag' ? (
                <label key={name} style={{ display: 'flex', gap: 6 }}>
                  <input id={`${item.id}-${name}`} type="checkbox" checked={Boolean(item[name])}
                    onChange={(e) => onChange(value.map((v) => (v.id === item.id ? { ...v, [name]: e.target.checked } : v)))} />
                  {f.label}
                </label>
              ) : f.kind === 'text' ? (
                <label key={name} style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
                  <span>{f.label} <small>({countChars(String(item[name] ?? ''))}{f.max ? ` / ${f.max}` : ''})</small></span>
                  <textarea id={`${item.id}-${name}`} rows={(f.max ?? 0) > 150 ? 4 : 1} value={String(item[name] ?? '')}
                    onChange={(e) => onChange(value.map((v) => (v.id === item.id ? { ...v, [name]: e.target.value } : v)))} />
                </label>
              ) : (
                <p key={name} style={{ fontSize: 13 }}>{f.label}: sayfada çift tıklayarak değiştirin.</p>
              ),
            )}
            {fixed ? null : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" aria-label="Aşağı taşı" disabled={i === value.length - 1} onClick={() => move(i, 1)}>↓</button>
                {confirm === item.id ? (
                  <>
                    <button type="button" onClick={() => { onChange(value.filter((v) => v.id !== item.id)); setConfirm(null); }}>Evet, sil</button>
                    <button type="button" onClick={() => setConfirm(null)}>Vazgeç</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirm(item.id)}>Sil</button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      {fixed ? null : <button type="button" onClick={add} disabled={value.length >= max}>Madde ekle</button>}
      <p style={{ fontSize: 13, color: '#5f4f75' }}>Boş bırakılan madde kaydedilmez; &quot;Kaydet&quot; uyarı verir.</p>
    </Drawer>
  );
}
