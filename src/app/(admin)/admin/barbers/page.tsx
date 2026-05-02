import Link from "next/link";
import { getAllBarbers } from "@/server/queries/barbers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableTableRow } from "@/components/admin/clickable-table-row";
import { PlusIcon, PencilIcon } from "lucide-react";

export default async function BarbersPage() {
  const barbers = await getAllBarbers();

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground" aria-current="page">Barberi</span>
      </nav>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Barberi</h1>
        <Link href="/admin/barbers/new">
          <Button size="sm">
            <PlusIcon className="mr-1 size-4" />
            Pridať
          </Button>
        </Link>
      </div>

      {barbers.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          Žiadni barberi. Pridajte prvého barbera.
        </p>
      )}

      <div className={barbers.length === 0 ? "hidden" : "space-y-3 md:hidden"}>
        {barbers.map((barber) => (
          <div key={barber.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {barber.firstName} {barber.lastName}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {barber.email || "Bez emailu"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {barber.phone || "Bez telefónu"}
                </p>
              </div>
              <Link href={`/admin/barbers/${barber.id}`} className="shrink-0">
                <Button variant="ghost" size="icon-sm">
                  <PencilIcon className="size-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={barber.isActive ? "default" : "secondary"}>
                {barber.isActive ? "Aktívny" : "Neaktívny"}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {barber.services.length > 0
                ? barber.services.map((bs) => bs.service.name).join(", ")
                : "Bez priradených služieb"}
            </p>
          </div>
        ))}
      </div>

      <div className={barbers.length === 0 ? "hidden" : "hidden md:block"}>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20%]">Meno</TableHead>
              <TableHead className="w-[20%]">Email</TableHead>
              <TableHead className="w-[15%]">Telefón</TableHead>
              <TableHead className="w-[30%]">Služby</TableHead>
              <TableHead className="w-[10%]">Stav</TableHead>
              <TableHead className="w-[5%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {barbers.map((barber) => (
              <ClickableTableRow
                key={barber.id}
                href={`/admin/barbers/${barber.id}`}
                ariaLabel={`Upraviť ${barber.firstName} ${barber.lastName}`}
              >
                <TableCell className="font-medium">
                  {barber.firstName} {barber.lastName}
                </TableCell>
                <TableCell className="truncate">{barber.email || "—"}</TableCell>
                <TableCell>{barber.phone || "—"}</TableCell>
                <TableCell>
                  <p className="line-clamp-2 text-sm">
                    {barber.services.length > 0
                      ? barber.services.map((bs) => bs.service.name).join(", ")
                      : "—"}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={barber.isActive ? "default" : "secondary"}>
                    {barber.isActive ? "Aktívny" : "Neaktívny"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/barbers/${barber.id}`}
                    aria-label="Upraviť barbera"
                  >
                    <Button variant="ghost" size="icon-sm">
                      <PencilIcon className="size-4" />
                    </Button>
                  </Link>
                </TableCell>
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
