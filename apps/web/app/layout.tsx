import type { Metadata } from "next";
import { Suspense } from "react";
import { Fredoka, Nunito, Martian_Mono } from "next/font/google";
import "./globals.css";
import Analytics from "./components/Analytics";
import MetaPixelGate from "./components/MetaPixelGate";
import ConsentDefaults from "./components/ConsentDefaults";
import CookieBanner from "./components/CookieBanner";
import VisitBeacon from "./components/VisitBeacon";
import JsonLd from "./components/JsonLd";
import { buildPreschoolSchema } from "../lib/schema";
import { SITE } from "../lib/site";
import { buildMetadata } from "../lib/metadata";
import { getReaderData } from "../lib/content/server";
import { makeReader } from "../lib/content/reader";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const martian = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const c = makeReader(await getReaderData());
  return {
    ...buildMetadata({
      title: c.text("site.name"),
      description: c.text("site.description"),
      path: "/",
    }),
    metadataBase: new URL(SITE.url),
  };
}

/**
 * Ziyaretçide içerik "use cache" ile önbellekte olduğundan Suspense içindeki alt ağaç da statik kabuğa
 * girer (sayfalar önceden üretilir). Draft mode'da Next önbelleği atlar ve içerik her istekte okunur;
 * bu dinamik okuma sınırsız olursa "blocking route" hatası verir. Bu yüzden içeriği bekleyen her şey
 * (JSON-LD, üst/alt bilgi, sayfalar) tek bir Suspense sınırının içindedir.
 */
async function SiteSchema() {
  const c = makeReader(await getReaderData());
  return <JsonLd data={buildPreschoolSchema(c)} />;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${fredoka.variable} ${nunito.variable} ${martian.variable} antialiased pb-14 md:pb-0`}
      >
        <ConsentDefaults />
        <Analytics />
        <MetaPixelGate />
        {/* fallback={null} yalnızca altındaki tüm sayfalar önbellekli/önceden üretilmiş olduğu sürece güvenlidir;
            dinamik (istek anında) bir sayfa eklenirse boş kabuk akıtılır ve notFound()/durum kodları bozulur. */}
        <Suspense fallback={null}>
          <SiteSchema />
          {children}
          <CookieBanner />
          <VisitBeacon />
        </Suspense>
      </body>
    </html>
  );
}
