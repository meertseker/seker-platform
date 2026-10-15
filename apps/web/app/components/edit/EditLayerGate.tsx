import { Suspense } from 'react';
import { getEditor } from '@seker/auth/editor';
import { createServerSupabase } from '@seker/auth/server';
import { isEditing } from '@/lib/content/getContent';
import { getReaderData } from '@/lib/content/server';
import type { AnnouncementRow } from '@/lib/content/types';
import EditLayerClient from './EditLayerClient';

/** Ziyaretçide (draft kapalı) hiçbir şey üretmez; prerender'da çerez okunmaz. */
export default async function EditLayerGate() {
  if (!(await isEditing())) return null;
  return (
    <Suspense fallback={null}>
      <EditLayerServer />
    </Suspense>
  );
}

async function EditLayerServer() {
  const [editor, data] = await Promise.all([getEditor(), getReaderData()]);
  let announcements: AnnouncementRow[] = [];
  if (editor) {
    const supabase = await createServerSupabase();
    const { data: rows } = await supabase
      .from('announcements')
      .select('id, title, body, image_id, starts_on, ends_on, published, sort, updated_at')
      .order('sort')
      .order('id');
    announcements = (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      imageId: r.image_id,
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      published: r.published,
      sort: r.sort,
      updatedAt: r.updated_at,
    }));
  }
  return <EditLayerClient editor={editor} data={data} announcements={announcements} />;
}
