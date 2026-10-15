'use client';

import { useEffect, useRef } from 'react';

export function Drawer({ title, onClose, children }: { title: string; onClose(): void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 2147483003, background: 'rgb(0 0 0 / 0.35)' }} onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 'min(480px, 100%)', overflowY: 'auto', background: '#fff', color: '#2a1840', padding: 20, font: '15px/1.5 system-ui' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ font: '600 18px system-ui', margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose}>Kapat</button>
        </div>
        {children}
      </div>
    </div>
  );
}
