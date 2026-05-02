import { notFound } from "next/navigation";
import { getCustomerById } from "@/server/queries/customers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import Link from "next/link";
import { CustomerActions } from "@/components/admin/customer-actions";
import {
  STATUS_LABELS,
  STATUS_VARIANTS,
  DATETIME_FORMAT,
} from "@/lib/constants";

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
      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <Link href="/admin/customers" className="hover:text-foreground">Zákazníci</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground" aria-current="page">{customer.firstName} {customer.lastName}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">
          {customer.firstName} {customer.lastName}
        </h1>
        <CustomerActions customer={{
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          email: customer.email,
          notes: customer.notes,
        }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kontaktné údaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Telefón</span>
              <span className="break-words sm:text-right">{customer.phone}</span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="break-words sm:text-right">{customer.email || "—"}</span>
            </div>
            <Separator />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium">
                        {format(appt.startTime, DATETIME_FORMAT, {
                          locale: sk,
                        })}
                      </span>
                      <Badge
                        variant={STATUS_VARIANTS[appt.status]}
                        className="self-start"
                      >
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
