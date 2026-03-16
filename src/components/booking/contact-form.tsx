"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const contactSchema = z.object({
  firstName: z.string().min(1, "Meno je povinné"),
  lastName: z.string(),
  phone: z.string().min(1, "Telefón je povinný"),
  email: z.string().email("Zadajte platný email"),
  note: z.string(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormProps {
  onSubmit: (data: ContactFormValues) => void;
}

export function ContactForm({ onSubmit }: ContactFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      note: "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
        <div className="flex gap-2">
          <span className="flex h-9 items-center rounded-lg border bg-muted px-3 text-sm text-muted-foreground">
            +421
          </span>
          <Input
            id="phone"
            type="tel"
            placeholder="9XX XXX XXX"
            {...register("phone")}
          />
        </div>
        {errors.phone && (
          <p className="text-xs text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email *</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Poznámka</Label>
        <Textarea
          id="note"
          rows={3}
          placeholder="Akékoľvek špeciálne požiadavky..."
          {...register("note")}
        />
      </div>

      <Button type="submit" className="w-full" size="lg">
        Pokračovať
      </Button>
    </form>
  );
}
