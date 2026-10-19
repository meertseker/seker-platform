import type { Metadata } from "next";
import { recentContentCodes } from "@/actions/lead-flow";
import { MessageLeadForm } from "@/components/message-lead-form";

export const metadata: Metadata = { title: "Mesajdan veli ekle" };
export const dynamic = "force-dynamic";

export default async function MessageLeadPage() {
  const codes = await recentContentCodes().catch(() => []);
  return <MessageLeadForm codes={codes.slice(0, 6)} />;
}
