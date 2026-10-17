import type { Metadata } from "next";
import { Fira_Code } from "next/font/google";
import "./globals.css";

// Gövde yazısı sistem fontu (globals.css --font-sans); yalnız mono için web fontu.
// latin-ext şart: Türkçe ğ/ş/ı/ç/ö/ü karakterleri için.
const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Şeker CRM",
  description: "Anaokulu lead ve kayıt takip sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${firaCode.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
