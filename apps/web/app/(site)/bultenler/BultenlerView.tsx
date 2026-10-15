import Image from 'next/image';
import PageHero from '@/app/components/PageHero';
import AnnouncementsSection from '@/app/components/AnnouncementsSection';
import TrackedLink from '@/app/components/TrackedLink';
import { Editable } from '@/app/components/edit/Editable';
import { phoneE164, whatsappUrl } from '@/lib/site';
import { makeReader } from '@/lib/content/reader';
import type { ReaderData } from '@/lib/content/types';
import type { PublicAnnouncement } from '@/lib/content/getContent';

/**
 * Bu sayfa daha önce tamamen uydurma veriyle doluydu: olmamış geziler,
 * 2025 tarihli sahte duyurular ve hiçbir dosya indirmeyen beş PDF
 * butonu. Hepsi kaldırıldı. Sayfa artık yalnızca doğrulanabilir olanı
 * anlatıyor; belgeler okuldan gelince buraya indirme bağlantısı olarak
 * eklenecek.
 */

type Channel = { id: string; title: string; body: string; band: string };

export default function BultenlerView({ data, announcements = [] }: { data: ReaderData; announcements?: PublicAnnouncement[] }) {
  const c = makeReader(data);
  const channels = c.list<Channel>('bultenler.channels');
  const photo = c.image('media.gardenWorkshops');
  return (
    <div className="min-h-screen bg-paper">
      <PageHero
        c={c}
        keys={{ eyebrow: 'bultenler.hero.eyebrow', title: 'bultenler.hero.title', lead: 'bultenler.hero.lead' }}
        tone="grape"
      />

      <AnnouncementsSection c={c} items={announcements} />

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-3" {...c.listAttrs('bultenler.channels')}>
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <div className={`flex h-32 items-end p-5 ${channel.band}`}>
                  <Editable
                    c={c}
                    k="bultenler.channels"
                    path={`${channel.id}.title`}
                    value={channel.title}
                    as="h2"
                    className="font-display text-2xl leading-tight text-white"
                  />
                </div>
                <Editable
                  c={c}
                  k="bultenler.channels"
                  path={`${channel.id}.body`}
                  value={channel.body}
                  as="p"
                  className="p-5 text-sm leading-relaxed text-ink-soft"
                />
              </div>
            ))}
          </div>

          <div className="mt-14 grid gap-8 rounded-[2rem] bg-white p-6 shadow-sm md:grid-cols-2 md:p-10">
            <div className="relative min-h-64 overflow-hidden rounded-[1.5rem]" {...c.attrs('media.gardenWorkshops')}>
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 768px) 100vw, 480px"
                className="object-cover"
              />
            </div>

            <div className="flex flex-col justify-center">
              <Editable c={c} k="bultenler.request.title" as="h2" className="text-2xl text-ink md:text-3xl" />
              <Editable c={c} k="bultenler.request.body" as="p" className="mt-4 text-ink-soft" />

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <TrackedLink
                  href={whatsappUrl(c)}
                  event="whatsapp_click"
                  payload={{ location: 'bultenler' }}
                  external
                  className="rounded-full bg-mint-deep px-7 py-3.5 text-center font-semibold text-white hover:bg-ink"
                  editAttrs={c.attrs('bultenler.request.ctaWhatsapp')}
                >
                  {c.text('bultenler.request.ctaWhatsapp')}
                </TrackedLink>
                <TrackedLink
                  href={`tel:${phoneE164(c)}`}
                  event="tel_click"
                  payload={{ location: 'bultenler' }}
                  external
                  className="rounded-full border-2 border-grape px-7 py-3.5 text-center font-semibold text-grape hover:bg-grape hover:text-white"
                  editAttrs={c.attrs('site.phone')}
                >
                  {c.text('site.phone')}
                </TrackedLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
