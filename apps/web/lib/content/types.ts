export type ContentKind = 'text' | 'rich' | 'image' | 'list';
export type FieldKind = 'text' | 'rich' | 'image' | 'flag';
export type FieldDef = { kind: FieldKind; max?: number; label: string };
export type SlotDef = {
  kind: ContentKind;
  max?: number;
  default: unknown;
  label: string;
  pattern?: string; // text için regex kaynağı (ör. saat, yıl); RegExp istemciye serileştirilemez
  fields?: Record<string, FieldDef>; // list için; her öğede ayrıca zorunlu `id: string`
  maxItems?: number; // list için, varsayılan 50
  fixedItems?: boolean; // list için: öğe eklenemez, silinemez, taşınamaz
  newItem?: Record<string, unknown>; // list için: yeni öğenin başlangıç alanları (fonksiyon değil: serileştirilebilir)
  allowHeadings?: boolean; // rich için: h2 izinli (yalnızca legal.*)
  warn?: string; // düzenleme çubuğunda gösterilecek uyarı
};
export type ImageValue = { src: string; alt: string; width: number; height: number; assetId: string | null };
export type ListItem = { id: string } & Record<string, unknown>;
export type ContentMap = Record<string, { value: unknown; updatedAt: string }>;
export type SlotMeta = Pick<
  SlotDef,
  'kind' | 'max' | 'fields' | 'label' | 'warn' | 'pattern' | 'maxItems' | 'fixedItems' | 'newItem' | 'allowHeadings'
>;
export type ReaderData = {
  values: Record<string, unknown>;
  updatedAt: Record<string, string>;
  meta: Record<string, SlotMeta>;
  editing: boolean;
  vars: { yilSayisi: string; kurulusYili: string };
};
export type Reader = {
  editing: boolean;
  text(key: string): string;
  rich(key: string): string;
  /** Belirteçleri ({yilSayisi}, {kurulusYili}) text() ile aynı şekilde doldurur; liste alanları için. */
  fill(s: string): string;
  image(key: string): ImageValue;
  list<T extends ListItem = ListItem>(key: string): T[];
  attrs(key: string, path?: string): Record<string, string>;
  listAttrs(key: string): Record<string, string>;
};
