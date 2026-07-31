# Fotoğraf Çekimi Brief'i

## Zorunlu kare — diğer her şeyden önce
**10 çocuklu sınıfın geniş açı fotoğrafı, iki öğretmen kadrajda.**
Reklamın, sitenin ve fiyatlandırmanın dayandığı tek iddianın görsel kanıtı.
`MEDIA.classroomWide` bu kareyle değiştirilecek.
Yatay, en az 2400 piksel genişlik.

## KVKK
Çocukların yüzü gösterilmez: arkadan, omuz üstünden, eller ve malzeme detayı,
mekân. Yüz kullanılacaksa veliden yazılı açık rıza; öğretmen portreleri için de
yazılı izin. Rıza formları çekimden ÖNCE toplanır.

## Teknik
Yatay 3:2, en az 2400 piksel genişlik, doğal ışık, filtre ve retouch yok.
Teslim: ham JPG. Web dönüşümü ayrıca yapılacak.

## Çekim sonrası
1. Dosyaları public/ altına koy
2. content/media.ts içinde src, width, height güncelle, status: 'gercek' yap
3. npm test -- media
4. pendingShootAssets() boş dizi dönene kadar tekrarla
