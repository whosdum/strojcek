import Link from "next/link";
import { getAllServices } from "@/server/queries/services";
import { ServicesView } from "@/components/admin/services-view";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await getAllServices();

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground" aria-current="page">Služby</span>
      </nav>
      <ServicesView services={services} />
    </div>
  );
}
