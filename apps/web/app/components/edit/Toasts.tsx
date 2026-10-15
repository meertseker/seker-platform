'use client';

export type Toast = { id: number; text: string; tone: 'ok' | 'error'; href?: string; hrefLabel?: string };

export function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="seker-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`seker-toast ${t.tone === 'error' ? 'error' : ''}`}>
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
