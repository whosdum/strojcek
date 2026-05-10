import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarketingForm } from "@/components/admin/marketing-form";

export const metadata = { title: "Marketing — Strojček admin" };

export default function MarketingPage() {
  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground" aria-current="page">Marketing</span>
      </nav>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Marketing</h1>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Hromadný email</CardTitle>
        </CardHeader>
        <CardContent>
          <MarketingForm />
        </CardContent>
      </Card>
    </div>
  );
}
