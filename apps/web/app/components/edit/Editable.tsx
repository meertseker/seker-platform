import type React from 'react';
import type { Reader } from '@/lib/content/types';

type Tag = keyof React.JSX.IntrinsicElements;

export function Editable({
  c,
  k,
  path,
  as = 'span',
  className,
  value,
}: {
  c: Reader;
  k: string;
  path?: string;
  as?: Tag;
  className?: string;
  value?: string;
}) {
  const Comp = as as React.ElementType;
  const text = value !== undefined ? c.fill(value) : c.text(k);
  return (
    <Comp className={className} {...c.attrs(k, path)}>
      {text}
    </Comp>
  );
}

export function EditableRich({
  c,
  k,
  path,
  as = 'div',
  className,
  value,
}: {
  c: Reader;
  k: string;
  path?: string;
  as?: 'div' | 'section';
  className?: string;
  value?: string;
}) {
  const Comp = as;
  // value yalnızca ReaderData'dan (buildReaderData'da temizlenmiş öğe alanı) verilmelidir; ham kullanıcı HTML'i buraya geçirilmez.
  const html = value !== undefined ? c.fill(value) : c.rich(k);
  return <Comp className={className} {...c.attrs(k, path)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function editImageAttrs(c: Reader, k: string, path?: string): Record<string, string> {
  return c.attrs(k, path);
}
