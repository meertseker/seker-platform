'use client';

import dynamic from 'next/dynamic';
import type { Editor } from '@seker/auth/editor';
import type { ReaderData, AnnouncementRow } from '@/lib/content/types';

const EditBar = dynamic(() => import('./EditBar'), { ssr: false });

export default function EditLayerClient(props: { editor: Editor | null; data: ReaderData; announcements: AnnouncementRow[] }) {
  return <EditBar {...props} />;
}
