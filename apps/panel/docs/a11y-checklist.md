# Erişilebilirlik Kabul Kriterleri (WCAG 2.2)

Her yeni/değişen ekran bu listeyi geçmeli. Kaynak: `docs/research/2026-07-14-ux-arastirma-sentezi.md` §3.

- [ ] Metin kontrastı ≥ 4.5:1 (büyük metin ve UI bileşen sınırları ≥ 3:1).
- [ ] Kritik gövde/hata/yardım metni ≥ 16px.
- [ ] Dokunma hedefleri ≥ 44×44px (mutlak min 24×24px, padding dahil).
- [ ] Durum yalnız renkle değil; renk + ikon + metin birlikte (bkz. `components/status-badge.tsx` + `lib/status-styles.ts`).
- [ ] Her form alanında görünür label; hata "ne oldu + nasıl düzelir".
- [ ] Görünür odak halkası (≥2px), sticky header altında kaybolmuyor (Focus Not Obscured).
- [ ] Sürükleme gereken her yerde tek-işaretçi alternatifi (buton/menü) var (Dragging Movements).
- [ ] %200 zoom ve artırılmış metin-aralığında düzen bozulmuyor (Türkçe metin genişlemesi).
- [ ] Tüm kritik akışlar klavye ile tamamlanabiliyor; modal odağı tuzaklıyor/geri veriyor.
- [ ] Türkçe karakterler (ı/İ/ş/ğ) net; dar kolonda metin sıkıştırılmıyor.
