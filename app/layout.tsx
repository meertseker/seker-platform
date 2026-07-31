import type { Metadata } from "next";
import { Bricolage_Grotesque, Newsreader, Martian_Mono } from "next/font/google";
import "./globals.css";
import Analytics from "./components/Analytics";
import ConsentDefaults from "./components/ConsentDefaults";
import CookieBanner from "./components/CookieBanner";
import JsonLd from "./components/JsonLd";
import { preschoolSchema } from "../lib/schema";
import { SITE } from "../lib/site";
import { buildMetadata } from "../lib/metadata";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const martian = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  ...buildMetadata({
    title: SITE.name,
    description: SITE.description,
    path: "/",
  }),
  metadataBase: new URL(SITE.url),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        <JsonLd data={preschoolSchema} />
      </head>
      <body
        className={`${bricolage.variable} ${newsreader.variable} ${martian.variable} antialiased pb-14 md:pb-0`}
      >
        <ConsentDefaults />
        <Analytics />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
