import { notFound } from "next/navigation";
import { getCustomerById } from "@/server/queries/customers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čaká",
  CONFIRMED: "Potvrdená",
  IN_PROGRESS: "Prebieha",
  COMPLETED: "Dokončená",
  CANCELLED: "Zrušená",
  NO_SHOW: "Neprišiel",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) notFound();

  return (
    <div>
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Späť na zoznam
      </Link>

      <h1 className="mb-6 text-2xl font-bold">
        {customer.firstName} {customer.lastName}
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kontaktné údaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Telefón</span>
              <span>{customer.phone}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{customer.email || "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Počet návštev</span>
              <span className="font-medium">{customer.visitCount}</span>
            </div>
            {customer.notes && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground">Poznámky:</span>
                  <p className="mt-1">{customer.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>História rezervácií</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žiadne rezervácie.</p>
            ) : (
              <div className="space-y-3">
                {customer.appointments.map((appt) => (
                  <Link
                    key={appt.id}
                    href={`/admin/reservations/${appt.id}`}
                    className="block rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {format(appt.startTime, "d.M.yyyy HH:mm", {
                          locale: sk,
                        })}
                      </span>
                      <Badge variant="outline">
                        {STATUS_LABELS[appt.status] ?? appt.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {appt.service.name} — {appt.barber.firstName}{" "}
                      {appt.barber.lastName}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
