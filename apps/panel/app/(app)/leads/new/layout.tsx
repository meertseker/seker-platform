import type { Metadata } from "next";

export const metadata: Metadata = { title: "Yeni veli" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
