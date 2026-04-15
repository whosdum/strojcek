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
  prefix: z.enum(["+421", "+420"]),
  phone: z
    .string()
    .min(1, "Telefón je povinný")
    .regex(/^[1-9]\d{8}$/, "Číslo bez predvoľby, bez úvodnej nuly (napr. 903123456)"),
  email: z.string().email("Zadajte platný email").or(z.literal("")),
  note: z.string(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormProps {
  onSubmit: (data: ContactFormValues) => void;
  defaultValues?: Partial<ContactFormValues>;
}

export function ContactForm(props: ContactFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      prefix: "+421",
      phone: "",
      email: "",
      note: "",
      ...props.defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(props.onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName" className="text-[15px] font-medium text-foreground">
            Meno <span className="text-primary">*</span>
          </Label>
          <Input
            id="firstName"
            className="h-11 bg-muted/30 text-foreground placeholder:text-muted-foreground/60"
            placeholder="Ján"
            {...register("firstName")}
          />
          {errors.firstName && (
            <p className="text-[13px] font-medium text-destructive">
              {errors.firstName.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName" className="text-[15px] font-medium text-foreground">
            Priezvisko
          </Label>
          <Input
            id="lastName"
            className="h-11 bg-muted/30 text-foreground placeholder:text-muted-foreground/60"
            placeholder="Novák"
            {...register("lastName")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-[15px] font-medium text-foreground">
          Telefón <span className="text-primary">*</span>
        </Label>
        <div className="flex gap-2">
          <select
            {...register("prefix")}
            className="flex h-11 items-center rounded-lg border border-border/40 bg-muted/30 px-2 text-sm font-medium text-foreground"
          >
            <option value="+421">+421</option>
            <option value="+420">+420</option>
          </select>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={9}
            placeholder="9XX XXX XXX"
            className="h-11 bg-muted/30 text-foreground placeholder:text-muted-foreground/60"
            {...register("phone", {
              onChange: (e) => {
                let val = e.target.value.replace(/\D/g, "");
                // Strip leading 0 — prefix is already selected
                if (val.startsWith("0")) val = val.slice(1);
                e.target.value = val.slice(0, 9);
              },
            })}
          />
        </div>
        {errors.phone && (
          <p className="text-[13px] font-medium text-destructive">
            {errors.phone.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[15px] font-medium text-foreground">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="jan@email.sk"
          className="h-11 bg-muted/30 text-foreground placeholder:text-muted-foreground/60"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-[13px] font-medium text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note" className="text-[15px] font-medium text-foreground">
          Poznámka
        </Label>
        <Textarea
          id="note"
          rows={3}
          placeholder="Špeciálne požiadavky..."
          className="bg-muted/30 text-foreground placeholder:text-muted-foreground/60"
          {...register("note")}
        />
      </div>

      <Button type="submit" className="h-12 w-full text-base font-semibold" size="lg">
        Ďalej
      </Button>
    </form>
  );
}
