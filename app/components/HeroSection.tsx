import Frame from './cine/Frame';
import Roster from './cine/Roster';
import Timecode from './cine/Timecode';
import TrackedLink from './TrackedLink';
import { SITE, WHATSAPP_URL } from '@/lib/site';
import { ROSTER_STATUS } from '@/content/day';

/**
 * Künye odaklı hero. Sınıf mevcudu ve öğretmen sayısı doğrulanana kadar
 * (ROSTER_STATUS.ready) Roster hiç render edilmez ve gövde metni bu
 * sayıları iddia olarak yazmaz — bkz. content/day.ts. Görsel yarısı bu
 * durumda bir Frame fotoğrafına düşer, hero'da boşluk kalmaz.
 */
export default function HeroSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-12 md:pt-24">
      <div className="grid gap-12 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div>
          <Timecode>
            Beykent · Büyükçekmece · {SITE.foundingYear}&apos;den beri
          </Timecode>

          <h1 className="mt-5 text-5xl text-ink md:text-6xl lg:text-7xl">
            Öğretmeni, çocuğunuzun bugün neden sessiz olduğunu fark eder.
          </h1>

          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Bu yaşta gelişimi en çok belirleyen şey, çocuğun öğretmeniyle
            kurduğu karşılıklı ilişki. Biz okulu buna göre kurduk
            {ROSTER_STATUS.ready ? (
              <>: sınıflarımızda {ROSTER_STATUS.childCount} çocuk var.</>
            ) : (
              <>
                : Millî Eğitim Bakanlığı yönetmeliği öğretmen başına yirmi
                çocuğa kadar izin veriyor, biz bu sınırın belirgin biçimde
                altında kalmayı tercih ettik.
              </>
            )}{' '}
            Beykent&apos;te {SITE.foundingYear}&apos;den beri, aynı adreste.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <TrackedLink
              href="/kayit"
              event="cta_click"
              payload={{ location: 'hero', target: 'kayit' }}
              className="rounded-full bg-ink px-8 py-4 text-center font-medium text-paper hover:bg-ink-soft"
            >
              Ön Görüşme Randevusu Alın
            </TrackedLink>
            <TrackedLink
              href={WHATSAPP_URL}
              event="whatsapp_click"
              payload={{ location: 'hero' }}
              external
              className="rounded-full border border-ink px-8 py-4 text-center font-medium text-ink hover:bg-paper-warm"
            >
              WhatsApp&apos;tan Yazın
            </TrackedLink>
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            Size uygun bir saat seçin. Kayıt zorunluluğu yok.
          </p>
        </div>

        <div className="md:justify-self-end">
          {ROSTER_STATUS.ready ? (
            <Roster
              childCount={ROSTER_STATUS.childCount}
              teacherCount={ROSTER_STATUS.teacherCount}
              limit={ROSTER_STATUS.limit}
            />
          ) : (
            <div className="w-full max-w-sm">
              <Frame
                mediaKey="classroomWide"
                grade="morning"
                ratio="portrait"
                priority
                sizes="(max-width: 768px) 100vw, 480px"
              />
              <Timecode className="mt-3 block">
                Sınıfı ön görüşmede birlikte görün
              </Timecode>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
