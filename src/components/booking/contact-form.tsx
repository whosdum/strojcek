"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Length caps mirror the server-side bookingInputSchema so abuse (giant
// names, RFC-bypassing emails) can't sneak past the form.
const NAME_MAX_LENGTH = 50;
const EMAIL_MAX_LENGTH = 254;
const NOTE_MAX_LENGTH = 500;

const contactSchema = z.object({
  firstName: z
    .string()
    .min(1, "Meno je povinné")
    .max(NAME_MAX_LENGTH, `Meno môže mať najviac ${NAME_MAX_LENGTH} znakov`),
  lastName: z
    .string()
    .min(1, "Priezvisko je povinné")
    .max(
      NAME_MAX_LENGTH,
      `Priezvisko môže mať najviac ${NAME_MAX_LENGTH} znakov`
    ),
  prefix: z.enum(["+421", "+420"]),
  phone: z
    .string()
    .min(1, "Telefón je povinný")
    .regex(/^[1-9]\d{8}$/, "Číslo bez predvoľby, bez úvodnej nuly (napr. 903123456)"),
  email: z
    .string()
    .min(1, "Email je povinný")
    .email("Zadajte platný email")
    .max(EMAIL_MAX_LENGTH, `Email môže mať najviac ${EMAIL_MAX_LENGTH} znakov`),
  note: z.string().max(NOTE_MAX_LENGTH, "Poznámka môže mať najviac 500 znakov"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormProps {
  onSubmit: (data: ContactFormValues) => void;
  defaultValues?: Partial<ContactFormValues>;
  /** When the server rejects the booking with a per-field error (e.g.
   *  email-rate-limit), the wizard sends the user back to this step
   *  with `serverError` set so it can be surfaced inline at the right
   *  field instead of as a generic banner. */
  serverError?: {
    field: "firstName" | "lastName" | "phone" | "email" | "note";
    message: string;
  } | null;
}

export function ContactForm(props: ContactFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors, touchedFields, isSubmitting },
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

  // When the parent passes a server-side rejection (e.g. email-rate-limit),
  // surface it on the matching field. The user can fix the value and the
  // standard onTouched flow clears the error on next interaction.
  const serverError = props.serverError;
  useEffect(() => {
    if (!serverError) return;
    setError(serverError.field, { type: "server", message: serverError.message });
  }, [serverError, setError]);

  const noteLength = watch("note")?.length ?? 0;
  const [phoneZeroHint, setPhoneZeroHint] = useState(false);

  // Lightweight check for button — only enabled when required fields are
  // present and there are no Zod validation errors. Earlier we kept a
  // separate regex for the email shape here, which silently drifted from
  // the server-side `z.email()` rule and could either lock the user out of
  // a valid address or let an invalid one through to the API.
  const firstName = watch("firstName");
  const lastName = watch("lastName");
  const phone = watch("phone");
  const email = watch("email");
  const hasFieldErrors = Boolean(
    errors.firstName || errors.lastName || errors.phone || errors.email
  );
  const canSubmit =
    !!firstName &&
    !!lastName &&
    phone.length === 9 &&
    email.length > 0 &&
    !hasFieldErrors;

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
            autoComplete="given-name"
            maxLength={NAME_MAX_LENGTH}
            aria-required
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            {...register("firstName")}
          />
          {touchedFields.firstName && errors.firstName && (
            <p id="firstName-error" className="text-[13px] font-medium text-destructive">
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
            autoComplete="family-name"
            maxLength={NAME_MAX_LENGTH}
            aria-required
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
            {...register("lastName")}
          />
          {touchedFields.lastName && errors.lastName && (
            <p id="lastName-error" className="text-[13px] font-medium text-destructive">
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
            autoComplete="tel-local"
            aria-required
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
            {...register("phone", {
              // Use setValue (not e.target.value mutation) so RHF's internal
              // value stays in sync with the DOM — direct mutation only
              // updates the input visually and leaves form.getValues().phone
              // pointing at the unstripped string.
              onChange: (e) => {
                const raw = e.target.value.replace(/\D/g, "");
                const stripped = raw.startsWith("0") ? raw.slice(1) : raw;
                setPhoneZeroHint(raw.startsWith("0"));
                setValue("phone", stripped.slice(0, 9), {
                  shouldValidate: true,
                  shouldDirty: true,
                });
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
          <p id="phone-error" className="text-[13px] font-medium text-destructive">
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
          autoComplete="email"
          maxLength={EMAIL_MAX_LENGTH}
          aria-required
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        {touchedFields.email && errors.email && (
          <p id="email-error" className="text-[13px] font-medium text-destructive">
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
          aria-invalid={!!errors.note}
          aria-describedby={errors.note ? "note-error" : undefined}
          {...register("note")}
        />
        <div className="flex items-center justify-between">
          {errors.note ? (
            <p id="note-error" className="text-[13px] font-medium text-destructive">
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
        disabled={!canSubmit || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2Icon className="size-5 animate-spin" />
            Odosielam...
          </>
        ) : (
          "Ďalej"
        )}
      </Button>
    </form>
  );
}
