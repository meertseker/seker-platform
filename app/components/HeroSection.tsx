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
    <section className="mx-auto max-w-6xl px-6 pt-8 pb-6 md:pt-24 md:pb-12">
      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-12">
        <div>
          <Timecode>
            Beykent · Büyükçekmece · {SITE.foundingYear}&apos;den beri
          </Timecode>

          <h1 className="mt-4 text-3xl text-ink md:mt-5 md:text-6xl lg:text-7xl">
            Öğretmeni, çocuğunuzun bugün neden sessiz olduğunu fark eder.
          </h1>

          <p className="mt-4 max-w-xl text-base text-ink-soft md:mt-6 md:text-lg">
            {ROSTER_STATUS.ready ? (
              <>
                Bu yaşta gelişimi en çok belirleyen şey, çocuğun öğretmeniyle
                kurduğu karşılıklı ilişki. Biz okulu buna göre kurduk:
                sınıflarımızda {ROSTER_STATUS.childCount} çocuk var.
                Beykent&apos;te {SITE.foundingYear}&apos;den beri, aynı adreste.
              </>
            ) : (
              // Künye kapıya kadar §7.1'in tam metni yerine kısaltılmış,
              // rakamsız bir sürüm kullanılır — hem doğrulanmamış sayı iddia
              // etmez hem mobilde formu ilk kaydırmanın dışına itmez. MEB üst
              // sınırı karşılaştırması (Bölüm 2 kapsamında) burada tekrar
              // edilmez, üst etikette zaten geçen kuruluş yılı da tekrarlanmaz.
              <>
                Bu yaşta gelişimi en çok belirleyen şey, çocuğun öğretmeniyle
                kurduğu karşılıklı ilişki. Biz okulu buna göre kurduk.
              </>
            )}
          </p>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row md:mt-9 md:gap-3">
            <TrackedLink
              href="/kayit"
              event="cta_click"
              payload={{ location: 'hero', target: 'kayit' }}
              className="rounded-full bg-ink px-8 py-3.5 text-center font-medium text-paper hover:bg-ink-soft md:py-4"
            >
              Ön Görüşme Randevusu Alın
            </TrackedLink>
            <TrackedLink
              href={WHATSAPP_URL}
              event="whatsapp_click"
              payload={{ location: 'hero' }}
              external
              className="rounded-full border border-ink px-8 py-3.5 text-center font-medium text-ink hover:bg-paper-warm md:py-4"
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
