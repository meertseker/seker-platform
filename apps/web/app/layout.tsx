import type { Metadata } from "next";
import { Fredoka, Nunito, Martian_Mono } from "next/font/google";
import "./globals.css";
import Analytics from "./components/Analytics";
import ConsentDefaults from "./components/ConsentDefaults";
import CookieBanner from "./components/CookieBanner";
import JsonLd from "./components/JsonLd";
import { preschoolSchema } from "../lib/schema";
import { SITE } from "../lib/site";
import { buildMetadata } from "../lib/metadata";

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
