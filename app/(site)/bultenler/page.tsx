import Image from 'next/image';
import PageHero from '@/app/components/PageHero';
import TrackedLink from '@/app/components/TrackedLink';
import { MEDIA } from '@/content/media';
import { SITE, WHATSAPP_URL } from '@/lib/site';
import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Bültenler ve Veli İletişimi',
  description:
    'Aylık yemek listesi, günlük program ve gelişim raporlarını velilerimizle nasıl paylaştığımız. Beykent Büyükçekmece Özel Şeker Anaokulu.',
  path: '/bultenler',
});

/**
 * Bu sayfa daha önce tamamen uydurma veriyle doluydu: olmamış geziler,
 * 2025 tarihli sahte duyurular ve hiçbir dosya indirmeyen beş PDF
 * butonu. Hepsi kaldırıldı. Sayfa artık yalnızca doğrulanabilir olanı
 * anlatıyor; belgeler okuldan gelince buraya indirme bağlantısı olarak
 * eklenecek.
 */

const CHANNELS = [
  {
    title: 'Çıkışta, yüz yüze',
    body: 'Çocuğunuzu alırken öğretmeni o günü size anlatır: ne yaptı, neyi zor buldu, neye ilk kez cesaret etti. Günlük iletişimin ana kanalı bu.',
    band: 'band-bubble',
  },
  {
    title: 'Gün içinde kameradan',
    body: 'Merak ettiğinizde sınıfa kameradan bakabilirsiniz. Çıkışta konuştuğumuz şey genelde gördüğünüzün arkasındaki hikâye oluyor.',
    band: 'band-mint',
  },
  {
    title: "WhatsApp'tan yazılı",
    body: 'Aylık yemek listesi, haftalık program ve etkinlik duyurularını veli grubundan paylaşıyoruz. Haftanın özel günlerini de buradan hatırlatıyoruz: çarşamba kitap, perşembe eşofman, cuma parti kıyafeti.',
    band: 'band-sky',
  },
];

export default function BultenlerPage() {
  return (
    <div className="min-h-screen bg-paper">
      <PageHero
        eyebrow="Veli İletişimi"
        title="Çocuğunuzun günü hakkında sizi karanlıkta bırakmıyoruz."
        lead="Aylık yemek listesi, günlük program ve gelişim değerlendirmesi — hepsini paylaşıyoruz. Aşağıda hangi kanalın ne işe yaradığı yazıyor."
        tone="grape"
      />

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {CHANNELS.map((channel) => (
              <div
                key={channel.title}
                className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <div className={`flex h-32 items-end p-5 ${channel.band}`}>
                  <h2 className="font-display text-2xl leading-tight text-white">
                    {channel.title}
                  </h2>
                </div>
                <p className="p-5 text-sm leading-relaxed text-ink-soft">{channel.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid gap-8 rounded-[2rem] bg-white p-6 shadow-sm md:grid-cols-2 md:p-10">
            <div className="relative min-h-64 overflow-hidden rounded-[1.5rem]">
              <Image
                src={MEDIA.gardenWorkshops.src}
                alt={MEDIA.gardenWorkshops.alt}
                fill
                sizes="(max-width: 768px) 100vw, 480px"
                className="object-cover"
              />
            </div>

            <div className="flex flex-col justify-center">
              <h2 className="text-2xl text-ink md:text-3xl">
                Belgeyi doğrudan isteyebilirsiniz.
              </h2>
              <p className="mt-4 text-ink-soft">
                Bu ayın yemek listesini, günlük program akışını ya da yaş grubunun
                haftalık planını görmek istiyorsanız yazın; aynı gün gönderiyoruz.
                Kayıtlı veli olmanız gerekmiyor.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <TrackedLink
                  href={WHATSAPP_URL}
                  event="whatsapp_click"
                  payload={{ location: 'bultenler' }}
                  external
                  className="rounded-full bg-mint-deep px-7 py-3.5 text-center font-semibold text-white hover:bg-ink"
                >
                  WhatsApp&apos;tan İsteyin
                </TrackedLink>
                <TrackedLink
                  href={`tel:${SITE.phone.e164}`}
                  event="tel_click"
                  payload={{ location: 'bultenler' }}
                  external
                  className="rounded-full border-2 border-grape px-7 py-3.5 text-center font-semibold text-grape hover:bg-grape hover:text-white"
                >
                  {SITE.phone.display}
                </TrackedLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
