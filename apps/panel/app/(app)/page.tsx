import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { homeFor } from "@/lib/role-access";

export default async function HomePage() {
  const profile = await getSessionProfile();
  redirect(homeFor(profile.role));
}
