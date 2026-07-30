export type FlowItem = {
  time: string;
  title: string;
  description: string;
};

export const DAILY_FLOW: FlowItem[] = [
  { time: '07:15 – 08:30', title: 'Karşılama ve serbest oyun', description: 'Çocuklar öğretmenleriyle bireysel karşılanır, güne yumuşak bir geçiş yapılır.' },
  { time: '08:30 – 09:00', title: 'Kahvaltı', description: 'TODO: Mutfak ve menü bilgisi.' },
  { time: '09:00 – 09:30', title: 'Sabah çemberi', description: 'Gün planı, hava durumu, paylaşım ve şarkılar.' },
  { time: '09:30 – 10:45', title: 'Ana çalışma saati', description: 'Yaş grubuna göre Montessori çalışmaları veya atölye.' },
  { time: '10:45 – 11:30', title: 'Bahçe zamanı', description: 'Hava koşulları elverdiğince her gün açık hava etkinliği.' },
  { time: '11:30 – 12:15', title: 'Öğle yemeği', description: 'TODO: Menü döngüsü ve diyetisyen onayı bilgisi.' },
  { time: '12:15 – 14:00', title: 'Dinlenme / sessiz saat', description: 'Küçük yaş gruplarında uyku, büyüklerde sakin etkinlik.' },
  { time: '14:00 – 15:30', title: 'Branş ve atölyeler', description: 'İngilizce, müzik, drama, robotik, satranç, seramik.' },
  { time: '15:30 – 16:00', title: 'İkindi kahvaltısı', description: 'TODO: İkindi kahvaltısında ne veriliyor?' },
  { time: '16:00 – 19:15', title: 'Serbest oyun ve uğurlama', description: 'Günün değerlendirmesi ve veli ile kısa bilgi paylaşımı.' },
];
