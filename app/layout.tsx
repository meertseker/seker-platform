import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";
import MobileActionBar from "./components/MobileActionBar";
import Analytics from "./components/Analytics";
import JsonLd from "./components/JsonLd";
import { preschoolSchema } from "../lib/schema";
import { SITE } from "../lib/site";
import { buildMetadata } from "../lib/metadata";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin-ext"],
  weight: ["400", "600"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin-ext"],
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
        className={`${fraunces.variable} ${inter.variable} antialiased pb-14 md:pb-0`}
      >
        <Analytics />
        {children}
        <Footer />
        <WhatsAppButton />
        <MobileActionBar />
      </body>
    </html>
  );
}
