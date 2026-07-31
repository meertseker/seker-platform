export default function Timecode({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`timecode text-ink-soft ${className}`}>{children}</span>;
}
