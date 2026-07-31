import Image from 'next/image'
import Link from 'next/link'

/**
 * Fix round 1/5, Important 3/4 — bu bölüm eski gradyan/hex paletini
 * taşıyordu ve bir açıklama cümlesi asset dosyası §5.1'in yasakladığı
 * türden bir zekâ-gelişimi iddiası içeriyordu. Kart metinleri artık §7.1
 * Bölüm 4'ün onaylı aktivite kartı tablosundan (satır 677-690) birebir
 * alınmıştır — zekâ değil, gözlemlenebilir beceri diliyle yazılmıştır.
 */
type Activity = {
  id: number
  baslik: string
  aciklama: string
  resim: string
  yasGrubu: string
}

const FEATURED_ACTIVITIES: Activity[] = [
  {
    id: 1,
    baslik: 'Seramik ve Sanat',
    aciklama: 'Hamur, makas ve fırça işi; el kaslarını yazıya hazırlayan çalışmalar.',
    resim: '/seramik.webp',
    yasGrubu: '3-6 yaş',
  },
  {
    id: 2,
    baslik: 'Müzik',
    aciklama: 'Ritim ve şarkı, dinleme becerisinin ve dilin günlük parçası.',
    resim: '/muzik.webp',
    yasGrubu: '3-6 yaş',
  },
  {
    id: 3,
    baslik: 'Dans',
    aciklama: 'Bedenini tanımak, ritmi takip etmek, grupla uyumlanmak.',
    resim: '/dans.webp',
    yasGrubu: '3-6 yaş',
  },
  {
    id: 4,
    baslik: 'Robotik Kodlama',
    aciklama: '"Önce bu, sonra şu" — sıralı düşünmenin oyunla ilk deneyimi.',
    resim: '/robotic.webp',
    yasGrubu: '3-6 yaş',
  },
]

const ActivitiesSection = () => {
  return (
    <section className="bg-paper-warm py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl text-ink md:text-4xl">Aktivitelerimiz</h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink-soft">
            Hangi çocuğun neyle açılacağını önceden bilemezsiniz. Bu yüzden
            programımız geniş — kendi ilgisini bulabileceği kadar çok kapı açar.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_ACTIVITIES.map((aktivite) => (
            <div key={aktivite.id} className="overflow-hidden rounded-2xl border border-rule bg-paper">
              <div className="relative h-48 bg-paper-warm">
                <Image
                  src={aktivite.resim}
                  alt={aktivite.baslik}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />
                <span className="absolute right-3 top-3 rounded-full bg-ink px-3 py-1 text-xs font-medium text-paper">
                  {aktivite.yasGrubu}
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-lg text-ink">{aktivite.baslik}</h3>
                <p className="mt-2 text-sm text-ink-soft">{aktivite.aciklama}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/aktiviteler" className="text-ink underline underline-offset-4">
            Tüm aktivitelerimizi görün
          </Link>
        </div>
      </div>
    </section>
  )
}

export default ActivitiesSection
