import type { Metadata } from 'next';
import { KVKK_TEXT } from '@/content/kvkk';
import { buildMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'KVKK Aydınlatma Metni',
  description: 'Özel Şeker Anaokulu kişisel verilerin korunması aydınlatma metni.',
  path: '/gizlilik',
});

export default function GizlilikPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <article className="mx-auto max-w-3xl">
            <h1 className="mb-2 font-display text-3xl text-ink md:text-4xl">KVKK Aydınlatma Metni</h1>
            <p className="mb-10 text-sm text-ink-soft">Son güncelleme: {KVKK_TEXT.updatedOn}</p>
            <div className="space-y-10">
              {KVKK_TEXT.sections.map((section) => (
                <section key={section.id} id={section.id} className="space-y-3">
                  <h2 className="font-display text-xl text-ink md:text-2xl">{section.title}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="leading-relaxed text-ink-soft">
                      {paragraph}
                    </p>
                  ))}
                  {section.items && (
                    <ul className="list-disc space-y-2 pl-6 text-ink-soft">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
