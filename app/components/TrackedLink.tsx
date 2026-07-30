'use client';
import Link from 'next/link';
import { trackEvent, type TrackedEvent } from '@/lib/analytics';

type Props = {
  href: string;
  event: TrackedEvent;
  payload?: Record<string, unknown>;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
};

export default function TrackedLink({
  href, event, payload = {}, external = false, className, children,
}: Props) {
  const handleClick = () => trackEvent(event, payload);

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
