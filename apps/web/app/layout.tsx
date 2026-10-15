import type { Metadata } from "next";
import { Fredoka, Nunito, Martian_Mono } from "next/font/google";
import "./globals.css";
import Analytics from "./components/Analytics";
import ConsentDefaults from "./components/ConsentDefaults";
import CookieBanner from "./components/CookieBanner";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const c = makeReader(await getReaderData());
  return (
    <html lang="tr">
      <head>
        <JsonLd data={buildPreschoolSchema(c)} />
      </head>
      <body
        className={`${fredoka.variable} ${nunito.variable} ${martian.variable} antialiased pb-14 md:pb-0`}
      >
        <ConsentDefaults />
        <Analytics />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
