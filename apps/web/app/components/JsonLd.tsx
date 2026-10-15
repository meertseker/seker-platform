/** Düzenlenebilir metinler </script> ile etiketten çıkamasın diye < ve satır ayırıcıları kaçırılır (JSON.parse aynı değeri verir). */
const LS = new RegExp(String.fromCharCode(0x2028), 'g');
const PS = new RegExp(String.fromCharCode(0x2029), 'g');

export function safeJson(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(LS, '\\u2028')
    .replace(PS, '\\u2029');
}

export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson(data) }}
    />
  );
}
