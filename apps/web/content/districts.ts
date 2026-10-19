/** Servis semtleri — panelin servis_semtleri tohumuyla aynı. "Diğer" servis dışı sayılır. */
export const DISTRICTS = ['Beykent', 'Beylikdüzü', 'Büyükçekmece', 'Esenyurt', 'Gürpınar', 'Yakuplu', 'Diğer'] as const;
export type District = (typeof DISTRICTS)[number];
