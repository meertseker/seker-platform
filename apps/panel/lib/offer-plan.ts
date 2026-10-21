/**
 * Onaylı teklif → kayıt planı sihirbazı. Teklif tutarı AYLIK aidattır
 * (offer-form: "Teklif tutarı (aylık TL)"); sihirbaza aylık olarak taşınır.
 */
export interface OfferForPlan {
  sourceOfferId: string;
  /** Teklifin aylık tutarı (TL). */
  monthlyTl: number;
  installmentCount: number;
}

/** Dönüştürme sonrası öğrenci sayfasına giden sorgu: plan sihirbazı açık, aylık tutar dolu. */
export function offerPlanQuery(offer: OfferForPlan): URLSearchParams {
  return new URLSearchParams({
    plan: "1",
    monthly: String(offer.monthlyTl),
    count: String(offer.installmentCount),
    offer: offer.sourceOfferId,
  });
}

/**
 * Sihirbazın aylık tutarı. Eski bağlantılardaki `total` da teklifin aylık tutarını taşıyordu
 * (yanlış adla); bölmeden aylık olarak okunur.
 */
export function initialMonthlyFromQuery(query: { monthly?: string; total?: string }): number | undefined {
  const value = Number(query.monthly ?? query.total);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
