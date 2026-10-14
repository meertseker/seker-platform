import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Leadler',
  description: 'Ön görüşme talepleri',
  path: '/admin',
  noindex: true,
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-paper">{children}</div>;
}
