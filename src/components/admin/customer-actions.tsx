"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PencilIcon } from "lucide-react";
import { CustomerEditForm } from "@/components/admin/customer-edit-form";
import { CustomerDeleteButton } from "@/components/admin/customer-delete-button";

interface CustomerActionsProps {
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
    notes: string | null;
  };
}

export function CustomerActions({ customer }: CustomerActionsProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setEditOpen(true)}
        className="w-full sm:w-auto"
      >
        <PencilIcon className="mr-1 size-4" />
        Upraviť
      </Button>
      <CustomerDeleteButton
        customerId={customer.id}
        customerName={`${customer.firstName} ${customer.lastName || ""}`.trim()}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upraviť zákazníka</DialogTitle>
          </DialogHeader>
          <CustomerEditForm
            customer={customer}
            onClose={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
