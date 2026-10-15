import { SITE } from './site';
import { makeReader } from './content/reader';
import { buildReaderData } from './content/server';
import { buildPreschoolSchema } from './schema';

/**
 * Varsayılan içerikle üretilmiş okul şeması (testler için). Sunucu tarafı modüle bağlıdır; schema.ts
 * istemci paketlerinden de içe aktarıldığı için sabit ayrı dosyadadır. Yıl yalnızca belirteçler içindir.
 */
export const preschoolSchema = buildPreschoolSchema(makeReader(buildReaderData({}, false, SITE.foundingYear)));
