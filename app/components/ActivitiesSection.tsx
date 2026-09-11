import Link from 'next/link'

/**
 * Atölye kartları bilinçli olarak fotoğrafsızdır: okulun seramik, müzik,
 * dans ve robotik atölyelerinden kendi çekimi henüz yok. Buraya bahçe
 * karesi koymak, fotoğrafın anlatmadığı bir şeyi anlatıyormuş gibi
 * gösterirdi — daha önce bu kartlarda duran stok görseller tam olarak
 * bunu yapıyordu. Çekim geldiğinde kartlara fotoğraf eklenir.
 */
type Activity = {
  id: number
  baslik: string
  aciklama: string
  yasGrubu: string
  /** Kartın üst bloğunun zemini — sitenin aksan sırası. */
  band: string
}

const FEATURED_ACTIVITIES: Activity[] = [
  {
    id: 1,
    baslik: 'Seramik ve Sanat',
    aciklama: 'Hamur, makas ve fırça işi; el kaslarını yazıya hazırlayan çalışmalar.',
    yasGrubu: '3-6 yaş',
    band: 'band-bubble',
  },
  {
    id: 2,
    baslik: 'Müzik',
    aciklama: 'Ritim ve şarkı, dinleme becerisinin ve dilin günlük parçası.',
    yasGrubu: '3-6 yaş',
    band: 'band-sunny',
  },
  {
    id: 3,
    baslik: 'Dans',
    aciklama: 'Bedenini tanımak, ritmi takip etmek, grupla uyumlanmak.',
    yasGrubu: '3-6 yaş',
    band: 'band-mint',
  },
  {
    id: 4,
    baslik: 'Robotik Kodlama',
    aciklama: '"Önce bu, sonra şu" — sıralı düşünmenin oyunla ilk deneyimi.',
    yasGrubu: '3-6 yaş',
    band: 'band-sky',
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
            <div key={aktivite.id} className="card-lift overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className={`relative flex h-40 items-end p-5 ${aktivite.band}`}>
                <span className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-grape shadow-sm">
                  {aktivite.yasGrubu}
                </span>
                <h3 className="font-display text-2xl leading-tight text-white">
                  {aktivite.baslik}
                </h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-ink-soft">{aktivite.aciklama}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/aktiviteler"
            className="inline-block rounded-full border-2 border-grape px-8 py-3 font-semibold text-grape hover:bg-grape hover:text-white"
          >
            Tüm aktivitelerimizi görün
          </Link>
        </div>
      </div>
    </section>
  )
}

export default ActivitiesSection
