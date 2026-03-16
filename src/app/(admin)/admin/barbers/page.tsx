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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Barbieri</h1>
        <Link href="/admin/barbers/new">
          <Button size="sm">
            <PlusIcon className="mr-1 size-4" />
            Pridať
          </Button>
        </Link>
      </div>

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
  );
}
