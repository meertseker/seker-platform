'use client';

export type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'warn'; href?: string; hrefLabel?: string; persistent?: boolean };

export function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="seker-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`seker-toast ${t.tone === 'error' ? 'error' : t.tone === 'warn' ? 'warn' : ''}`}>
          {t.text}
          {t.href ? (
            <>
              {' '}
              <a href={t.href} style={{ textDecoration: 'underline' }}>{t.hrefLabel}</a>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
