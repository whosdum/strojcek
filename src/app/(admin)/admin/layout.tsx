import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/lib/auth";
import { Sidebar } from "@/components/admin/sidebar";

export default async function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (e) {
    console.error("[admin/layout] Session check failed:", e);
    // DB cold start or transient error — don't redirect to login
    // Let the page render; client-side auth will handle it
  }

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-muted/20 md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
