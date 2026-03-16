import Link from "next/link";
import { getCustomers } from "@/server/queries/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EyeIcon, SearchIcon } from "lucide-react";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const search = params.search || "";

  const { items, total, pages } = await getCustomers(page, search || undefined);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Zákazníci</h1>

      {/* Search */}
      <form className="mb-4 flex max-w-sm gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            name="search"
            placeholder="Hľadať meno, telefón, email..."
            defaultValue={search}
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Hľadať
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Meno</TableHead>
            <TableHead>Telefón</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Návštevy</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="font-medium">
                {customer.firstName} {customer.lastName}
              </TableCell>
              <TableCell>{customer.phone}</TableCell>
              <TableCell>{customer.email || "—"}</TableCell>
              <TableCell>{customer.visitCount}</TableCell>
              <TableCell>
                <Link href={`/admin/customers/${customer.id}`}>
                  <Button variant="ghost" size="icon-sm">
                    <EyeIcon className="size-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/customers?page=${p}${search ? `&search=${search}` : ""}`}
            >
              <Button variant={p === page ? "default" : "outline"} size="sm">
                {p}
              </Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
