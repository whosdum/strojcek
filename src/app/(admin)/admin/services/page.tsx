"use client";

import { useEffect, useState } from "react";
import { getAllServices } from "@/server/queries/services";
import { toggleServiceActive } from "@/server/actions/services";
import { ServiceForm } from "@/components/admin/service-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon, PencilIcon } from "lucide-react";

// This needs to be a server component but we need dialog state.
// Using a hybrid approach: server data + client dialog.

export default function ServicesPage() {
  // Since this is "use client", we need to fetch data client-side or use a different approach.
  // Let's convert to use server action wrapper.
  return <ServicesContent />;
}

function ServicesContent() {
  const [services, setServices] = useState<Awaited<ReturnType<typeof getAllServices>>>([]);
  const [open, setOpen] = useState(false);
  const [editService, setEditService] = useState<typeof services[number] | null>(null);

  const loadServices = async () => {
    const res = await fetch("/api/admin/services");
    const data = await res.json();
    setServices(data);
  };

  useEffect(() => {
    loadServices();
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Služby</h1>
        <Button size="sm" onClick={handleNew}>
          <PlusIcon className="mr-1 size-4" />
          Pridať
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Názov</TableHead>
            <TableHead>Trvanie</TableHead>
            <TableHead>Cena</TableHead>
            <TableHead>Buffer</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => (
            <TableRow key={service.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{service.name}</p>
                  {service.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {service.description}
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>{service.durationMinutes} min</TableCell>
              <TableCell>{parseFloat(service.price.toString()).toFixed(2)} €</TableCell>
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
  );
}
