import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";
import WhatsAppButton from "./components/WhatsAppButton";
import MobileActionBar from "./components/MobileActionBar";
import Analytics from "./components/Analytics";
import JsonLd from "./components/JsonLd";
import { preschoolSchema } from "../lib/schema";
import { SITE } from "../lib/site";
import { buildMetadata } from "../lib/metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased pb-14 md:pb-0`}
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
