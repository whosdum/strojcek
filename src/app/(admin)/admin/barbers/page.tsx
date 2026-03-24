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
import { PlusIcon, PencilIcon } from "lucide-react";

export default async function BarbersPage() {
  const barbers = await getAllBarbers();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Barbieri</h1>
        <Link href="/admin/barbers/new">
          <Button size="sm">
            <PlusIcon className="mr-1 size-4" />
            Pridať
          </Button>
        </Link>
      </div>

      <div className="space-y-3 md:hidden">
        {barbers.map((barber) => (
          <div key={barber.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {barber.firstName} {barber.lastName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {barber.email || "Bez emailu"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {barber.phone || "Bez telefónu"}
                </p>
              </div>
              <Link href={`/admin/barbers/${barber.id}`}>
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

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meno</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefón</TableHead>
              <TableHead>Služby</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {barbers.map((barber) => (
              <TableRow key={barber.id}>
                <TableCell className="font-medium">
                  {barber.firstName} {barber.lastName}
                </TableCell>
                <TableCell>{barber.email || "—"}</TableCell>
                <TableCell>{barber.phone || "—"}</TableCell>
                <TableCell>
                  {barber.services.length > 0
                    ? barber.services.map((bs) => bs.service.name).join(", ")
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={barber.isActive ? "default" : "secondary"}>
                    {barber.isActive ? "Aktívny" : "Neaktívny"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/barbers/${barber.id}`}>
                    <Button variant="ghost" size="icon-sm">
                      <PencilIcon className="size-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
