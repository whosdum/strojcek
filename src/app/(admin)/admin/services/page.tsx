"use client";

import { useEffect, useState } from "react";
import { getAllServices } from "@/server/queries/services";
import { ServiceForm } from "@/components/admin/service-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon, PencilIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/constants";

// This needs to be a server component but we need dialog state.
// Using a hybrid approach: server data + client dialog.

export default function ServicesPage() {
  // Since this is "use client", we need to fetch data client-side or use a different approach.
  // Let's convert to use server action wrapper.
  return <ServicesContent />;
}

function ServicesContent() {
  const [services, setServices] = useState<Awaited<ReturnType<typeof getAllServices>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editService, setEditService] = useState<typeof services[number] | null>(null);

  const loadServices = async () => {
    const res = await fetch("/api/admin/services");
    const data = await res.json();
    setServices(data);
    setLoading(false);
  };

  useEffect(() => {
    let ignore = false;

    void fetch("/api/admin/services")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setServices(data);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleEdit = (service: typeof services[number]) => {
    setEditService(service);
    setOpen(true);
  };

  const handleNew = () => {
    setEditService(null);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditService(null);
    loadServices();
  };

  return (
    <div>
      <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">Dashboard</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">Služby</span>
      </nav>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Služby</h1>
        <Button size="sm" onClick={handleNew}>
          <PlusIcon className="mr-1 size-4" />
          Pridať
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editService ? "Upraviť službu" : "Nová služba"}
            </DialogTitle>
          </DialogHeader>
          <ServiceForm
            service={
              editService
                ? {
                    ...editService,
                    price: editService.price.toString(),
                  }
                : undefined
            }
            onClose={handleClose}
          />
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : services.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Žiadne služby. Pridajte prvú službu.
        </p>
      ) : null}

      <div className={loading || services.length === 0 ? "hidden" : "space-y-3 md:hidden"}>
        {services.map((service) => (
          <div key={service.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{service.name}</p>
                {service.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {service.description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleEdit(service)}
                className="shrink-0"
              >
                <PencilIcon className="size-4" />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{service.durationMinutes} min</Badge>
              <Badge variant="outline">
                {formatCurrency(service.price)}
              </Badge>
              <Badge variant="outline">{service.bufferMinutes} min buffer</Badge>
              <Badge variant={service.isActive ? "default" : "secondary"}>
                {service.isActive ? "Aktívna" : "Neaktívna"}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <div className={loading || services.length === 0 ? "hidden" : "hidden md:block"}>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Názov</TableHead>
              <TableHead className="w-[10%]">Trvanie</TableHead>
              <TableHead className="w-[10%]">Cena</TableHead>
              <TableHead className="w-[10%]">Buffer</TableHead>
              <TableHead className="w-[15%]">Stav</TableHead>
              <TableHead className="w-[5%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{service.name}</p>
                    {service.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {service.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{service.durationMinutes} min</TableCell>
                <TableCell>
                  {formatCurrency(service.price)}
                </TableCell>
                <TableCell>{service.bufferMinutes} min</TableCell>
                <TableCell>
                  <Badge variant={service.isActive ? "default" : "secondary"}>
                    {service.isActive ? "Aktívna" : "Neaktívna"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEdit(service)}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
