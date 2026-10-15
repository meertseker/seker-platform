import Image from 'next/image';
import type { PublicAnnouncement } from '@/lib/content/getContent';
import type { Reader } from '@/lib/content/types';

export default function AnnouncementsSection({ c, items }: { c: Reader; items: PublicAnnouncement[] }) {
  if (!items.length && !c.editing) return null;
  return (
    <section className="py-12">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl text-ink md:text-3xl" {...c.attrs('bultenler.announcements.title')}>{c.text('bultenler.announcements.title')}</h2>
        {!items.length ? (
          <p className="mt-4 text-ink-soft" {...c.attrs('bultenler.announcements.empty')}>{c.text('bultenler.announcements.empty')}</p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {items.map((a) => (
              <article key={a.id} className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm" {...(c.editing ? { 'data-edit-announcement': a.id } : {})}>
                {a.imageSrc ? (
                  <div className="relative aspect-[16/9]">
                    <Image src={a.imageSrc} alt={a.imageAlt ?? ''} fill sizes="(max-width: 768px) 100vw, 560px" className="object-cover" />
                  </div>
                ) : null}
                <div className="p-5">
                  <h3 className="font-display text-xl text-ink">{a.title}</h3>
                  <div className="prose mt-2 text-sm text-ink-soft" dangerouslySetInnerHTML={{ __html: a.body }} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
