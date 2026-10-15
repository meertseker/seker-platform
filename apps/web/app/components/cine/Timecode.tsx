export default function Timecode({
  children,
  className = '',
  editAttrs,
}: {
  children: React.ReactNode;
  className?: string;
  /** Düzenleme modunda `c.attrs(...)` çıktısı; ziyaretçiye boş gelir. */
  editAttrs?: Record<string, string>;
}) {
  return <span className={`timecode text-grape ${className}`} {...editAttrs}>{children}</span>;
}
