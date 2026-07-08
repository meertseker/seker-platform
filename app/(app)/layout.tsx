import { getSessionProfile } from "@/lib/auth";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getSessionProfile();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <Nav fullName={profile.full_name} role={profile.role} />
      <div className="md:pl-64">
        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-28 pt-4 sm:px-6 md:pb-8 md:pt-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
