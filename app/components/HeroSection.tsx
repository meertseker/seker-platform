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
    <section className="relative overflow-hidden px-6 pt-8 pb-6 md:pt-24 md:pb-12">
      {/* Şeker konfetisi — ana sayfanın açılışını bantlarla aynı dile bağlar. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="confetti-float absolute -left-10 top-4 h-40 w-40 rounded-full bg-bubble/10" />
        <span className="confetti-float absolute right-[4%] top-1/3 h-24 w-24 rounded-full bg-sunny/15" />
        <span className="confetti-float absolute left-1/3 -bottom-8 h-28 w-28 rounded-full bg-mint/10" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-6 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-12">
        <div>
          <span className="inline-flex rounded-full bg-paper-warm px-4 py-1.5">
            <Timecode>
              Beykent · Büyükçekmece · {SITE.foundingYear}&apos;den beri
            </Timecode>
          </span>

          <h1 className="mt-4 text-3xl text-ink md:mt-5 md:text-6xl lg:text-7xl">
            Çocuğunuzu adıyla, huyuyla tanıyan bir okul.
          </h1>

          <p className="mt-4 max-w-xl text-base text-ink-soft md:mt-6 md:text-lg">
            {ROSTER_STATUS.ready ? (
              <>
                Sınıfta {ROSTER_STATUS.childCount} çocuk var, başlarında iki
                öğretmen. Gün içinde merak ederseniz kameradan bakabiliyorsunuz.
                Beykent&apos;te {SITE.foundingYear}&apos;den beri buradayız; ilk
                yıllarda uğurladığımız çocukların kardeşleri şimdi bizde okuyor.
              </>
            ) : (
              <>
                Çocuğunuzun günü, öğretmeniyle arasında geçenlerden ibaret.
                Biz de bütün kararlarımızı buna göre veriyoruz.
              </>
            )}
          </p>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row md:mt-9 md:gap-3">
            <TrackedLink
              href="/kayit"
              event="cta_click"
              payload={{ location: 'hero', target: 'kayit' }}
              className="rounded-full bg-grape px-8 py-3.5 text-center font-semibold text-white shadow-lg shadow-grape/30 hover:bg-ink md:py-4"
            >
              Ön Görüşme Randevusu Alın
            </TrackedLink>
            <TrackedLink
              href={WHATSAPP_URL}
              event="whatsapp_click"
              payload={{ location: 'hero' }}
              external
              className="rounded-full border-2 border-mint-deep px-8 py-3.5 text-center font-semibold text-ink hover:bg-mint/10 md:py-4"
            >
              WhatsApp&apos;tan Yazın
            </TrackedLink>
          </div>
          <p className="mt-2 text-xs text-ink-soft md:mt-3 md:text-sm">
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
            // Fotoğraf, künyenin yerini tutan ikincil bir görsel — birincil
            // içerik değil. 375 px'te dikey olarak yığıldığında formu ilk
            // kaydırmanın dışına iterdi, bu yüzden mobilde gizli; md+
            // genişlikte iki sütun yan yana olduğunda tekrar görünür.
            <div className="hidden w-full max-w-sm md:block">
              <Frame
                mediaKey="classroomWide"
                grade="morning"
                ratio="wide"
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
