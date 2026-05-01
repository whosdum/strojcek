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
import { ChevronRightIcon, EyeIcon, SearchIcon } from "lucide-react";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; search?: string }>;
}) {
  const params = await searchParams;
  const cursor = params.cursor;
  const search = params.search || "";

  const { items, nextCursor } = await getCustomers(cursor, search || undefined);
  const searchSuffix = search ? `&search=${encodeURIComponent(search)}` : "";

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Zákazníci</span>
      </nav>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Zákazníci</h1>

      {/* Search */}
      <form className="mb-4 flex max-w-md flex-col gap-2 sm:flex-row">
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

      {items.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          {search ? "Žiadne výsledky pre dané vyhľadávanie." : "Žiadni zákazníci."}
        </p>
      )}

      <div className={items.length === 0 ? "hidden" : "space-y-3 md:hidden"}>
        {items.map((customer) => (
          <Link
            key={customer.id}
            href={`/admin/customers/${customer.id}`}
            className="block rounded-xl border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {customer.phone}
                </p>
                <p className="text-sm text-muted-foreground">
                  {customer.email || "Bez emailu"}
                </p>
              </div>
              <ChevronRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Návštevy: <span className="font-medium text-foreground">{customer.visitCount}</span>
            </p>
          </Link>
        ))}
      </div>

      <div className={items.length === 0 ? "hidden" : "hidden md:block"}>
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
                <TableCell>
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="font-medium hover:underline"
                  >
                    {customer.firstName} {customer.lastName}
                  </Link>
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
      </div>

      {(cursor || nextCursor) && (
        <div className="mt-4 flex items-center justify-between gap-2">
          {cursor ? (
            <Link href={`/admin/customers${search ? `?${searchSuffix.slice(1)}` : ""}`}>
              <Button variant="outline" size="sm">
                Prvá strana
              </Button>
            </Link>
          ) : (
            <span />
          )}
          {nextCursor && (
            <Link href={`/admin/customers?cursor=${nextCursor}${searchSuffix}`}>
              <Button variant="outline" size="sm">
                Ďalšia
                <ChevronRightIcon className="ml-1 size-4" />
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
