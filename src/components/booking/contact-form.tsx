"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const contactSchema = z.object({
  firstName: z.string().min(1, "Meno je povinné"),
  lastName: z.string().min(1, "Priezvisko je povinné"),
  prefix: z.enum(["+421", "+420"]),
  phone: z
    .string()
    .min(1, "Telefón je povinný")
    .regex(/^[1-9]\d{8}$/, "Číslo bez predvoľby, bez úvodnej nuly (napr. 903123456)"),
  email: z.string().min(1, "Email je povinný").email("Zadajte platný email"),
  note: z.string().max(500, "Poznámka môže mať najviac 500 znakov"),
});

const NOTE_MAX_LENGTH = 500;

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormProps {
  onSubmit: (data: ContactFormValues) => void;
  defaultValues?: Partial<ContactFormValues>;
}

export function ContactForm(props: ContactFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, touchedFields },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    mode: "onTouched",
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

  const noteLength = watch("note")?.length ?? 0;
  const [phoneZeroHint, setPhoneZeroHint] = useState(false);

  // Lightweight check for button — required fields have content
  const firstName = watch("firstName");
  const lastName = watch("lastName");
  const phone = watch("phone");
  const email = watch("email");
  const canSubmit = !!firstName && !!lastName && phone.length === 9 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

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
          {touchedFields.firstName && errors.firstName && (
            <p className="text-[13px] font-medium text-destructive">
              {errors.firstName.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName" className="text-[15px] font-medium text-foreground">
            Priezvisko <span className="text-primary">*</span>
          </Label>
          <Input
            id="lastName"
            className="h-11 bg-muted/30 text-foreground placeholder:text-muted-foreground/60"
            placeholder="Novák"
            {...register("lastName")}
          />
          {touchedFields.lastName && errors.lastName && (
            <p className="text-[13px] font-medium text-destructive">
              {errors.lastName.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-[15px] font-medium text-foreground">
          Telefón <span className="text-primary">*</span>
        </Label>
        <div className="flex gap-2">
          <div className="relative">
            <select
              {...register("prefix")}
              className="flex h-11 appearance-none items-center rounded-lg border border-border/40 bg-muted/30 py-2 pl-3 pr-8 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="+421">+421</option>
              <option value="+420">+420</option>
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
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
                if (val.startsWith("0")) {
                  val = val.slice(1);
                  setPhoneZeroHint(true);
                } else {
                  setPhoneZeroHint(false);
                }
                e.target.value = val.slice(0, 9);
              },
            })}
          />
        </div>
        {phoneZeroHint && (
          <p className="text-[13px] font-medium text-primary">
            Číslo bez predvoľby, bez úvodnej nuly (napr. 903123456)
          </p>
        )}
        {!phoneZeroHint && touchedFields.phone && errors.phone && (
          <p className="text-[13px] font-medium text-destructive">
            {errors.phone.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[15px] font-medium text-foreground">
          Email <span className="text-primary">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="jan.novak@email.sk"
          className="h-11 bg-muted/30 text-foreground placeholder:text-muted-foreground/60"
          {...register("email")}
        />
        {touchedFields.email && errors.email && (
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
          maxLength={NOTE_MAX_LENGTH}
          placeholder="Špeciálne požiadavky..."
          className="bg-muted/30 text-foreground placeholder:text-muted-foreground/60"
          {...register("note")}
        />
        <div className="flex items-center justify-between">
          {errors.note ? (
            <p className="text-[13px] font-medium text-destructive">
              {errors.note.message}
            </p>
          ) : (
            <span />
          )}
          <span className={`text-[12px] tabular-nums ${noteLength > NOTE_MAX_LENGTH * 0.9 ? "text-destructive" : "text-muted-foreground/60"}`}>
            {noteLength}/{NOTE_MAX_LENGTH}
          </span>
        </div>
      </div>

      <Button
        type="submit"
        className="h-12 w-full text-base font-semibold"
        size="lg"
        disabled={!canSubmit}
      >
        Ďalej
      </Button>
    </form>
  );
}
