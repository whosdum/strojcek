"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerInputSchema, type CustomerInput } from "@/lib/validators";
import { updateCustomer } from "@/server/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";

interface CustomerEditFormProps {
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
    notes: string | null;
  };
  onClose: () => void;
}

export function CustomerEditForm({ customer, onClose }: CustomerEditFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(customerInputSchema) as any,
    defaultValues: {
      firstName: customer.firstName,
      lastName: customer.lastName || "",
      phone: customer.phone,
      email: customer.email || "",
      notes: customer.notes || "",
    },
  });

  const onSubmit = async (data: CustomerInput) => {
    setError(null);
    const result = await updateCustomer(customer.id, data);
    if (result.success) {
      router.refresh();
      onClose();
    } else {
      setError(result.error || "Nastala chyba.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Meno *</Label>
          <Input id="firstName" {...register("firstName")} />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Priezvisko</Label>
          <Input id="lastName" {...register("lastName")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefón *</Label>
        <Input id="phone" {...register("phone")} />
        {errors.phone && (
          <p className="text-xs text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register("email")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Poznámky</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="w-full sm:w-auto"
        >
          Zrušiť
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          {isSubmitting && <Loader2Icon className="mr-1 size-4 animate-spin" />}
          Uložiť
        </Button>
      </div>
    </form>
  );
}
