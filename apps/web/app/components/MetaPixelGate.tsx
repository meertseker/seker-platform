import { isEditing } from '@/lib/content/getContent';
import { metaPixelId } from '@/lib/metaPixel';
import MetaPixel from './MetaPixel';

/** Sunucu sarmalayıcı: düzenleme (draft) modunda ve kimlik boşken piksel hiç render edilmez (Analytics gibi). */
export default async function MetaPixelGate() {
  if (!metaPixelId()) return null;
  if (await isEditing()) return null;
  return <MetaPixel />;
}
