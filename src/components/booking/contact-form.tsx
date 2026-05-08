"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckIcon, ChevronDownIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
  /**
   * Fired on unmount with whatever the user has typed so the wizard can
   * persist it as a draft. The wizard re-feeds these values via
   * `defaultValues` if the user navigates back to this step (e.g. after
   * changing date/time). Without this hook, anything typed is lost
   * because RHF's internal state dies with the component.
   */
  onDraftChange?: (data: ContactFormValues) => void;
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
    getValues,
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

  // When the form remounts with a draft (user filled some fields, went
  // back to change date, came back) RHF re-seeds the inputs from
  // `defaultValues` but `touchedFields` is empty — so the green success
  // indicator wouldn't fire even though the values are valid. Re-set
  // each non-empty pre-filled field with `shouldTouch + shouldValidate`
  // so it's marked as touched and re-validated on mount.
  useEffect(() => {
    const dv = props.defaultValues;
    if (!dv) return;
    const fields = ["firstName", "lastName", "phone", "email"] as const;
    for (const f of fields) {
      const v = dv[f];
      if (v) setValue(f, v, { shouldTouch: true, shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save-on-unmount draft hook. Stash the latest callback in a ref so
  // the cleanup effect's deps stay empty — otherwise a parent that
  // re-creates the callback on every render would fire cleanup→effect
  // every render and the unmount snapshot would never run.
  const onDraftChangeRef = useRef(props.onDraftChange);
  useEffect(() => {
    onDraftChangeRef.current = props.onDraftChange;
  });
  useEffect(() => {
    return () => {
      const cb = onDraftChangeRef.current;
      if (!cb) return;
      const values = getValues();
      // Skip empty unmounts so we don't overwrite a real draft with a
      // fresh-mount snapshot during e.g. an HMR reload.
      if (
        !values.firstName &&
        !values.lastName &&
        !values.phone &&
        !values.email &&
        !values.note
      ) {
        return;
      }
      cb(values);
    };
  }, [getValues]);

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
  // Optional note hidden behind a toggle. Auto-opens when the user is
  // returning to this step (e.g. server-side validation kicked them
  // back) and they had previously typed something.
  const [showNote, setShowNote] = useState(
    Boolean(props.defaultValues?.note?.length)
  );

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
  // Per-field "happy path" indicator — true when the user has interacted
  // with the field AND the value passes Zod validation. Drives a green
  // ring + checkmark icon so each correctly filled field gives positive
  // visual feedback (more motivating than "no error" silence).
  const isFirstNameValid =
    touchedFields.firstName && !errors.firstName && !!firstName;
  const isLastNameValid =
    touchedFields.lastName && !errors.lastName && !!lastName;
  const isPhoneValid =
    touchedFields.phone && !errors.phone && phone.length === 9;
  const isEmailValid = touchedFields.email && !errors.email && !!email;

  // Reused Tailwind class strings — green ring on the input + a checkmark
  // icon absolutely positioned on the right edge.
  const successInputCls = "border-emerald-500/70 ring-2 ring-emerald-500/20";
  const successIconCls =
    "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-emerald-500";

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
          <div className="relative">
            <Input
              id="firstName"
              className={cn(
                "h-11 bg-muted/30 pr-9 text-foreground placeholder:text-muted-foreground/60",
                isFirstNameValid && successInputCls
              )}
              placeholder="Ján"
              autoComplete="given-name"
              maxLength={NAME_MAX_LENGTH}
              aria-required
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? "firstName-error" : undefined}
              {...register("firstName")}
            />
            {isFirstNameValid && (
              <CheckIcon className={successIconCls} aria-hidden="true" />
            )}
          </div>
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
          <div className="relative">
            <Input
              id="lastName"
              className={cn(
                "h-11 bg-muted/30 pr-9 text-foreground placeholder:text-muted-foreground/60",
                isLastNameValid && successInputCls
              )}
              placeholder="Novák"
              autoComplete="family-name"
              maxLength={NAME_MAX_LENGTH}
              aria-required
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? "lastName-error" : undefined}
              {...register("lastName")}
            />
            {isLastNameValid && (
              <CheckIcon className={successIconCls} aria-hidden="true" />
            )}
          </div>
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
          <div className="relative flex-1">
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={9}
              placeholder="9XX XXX XXX"
              className={cn(
                "h-11 bg-muted/30 pr-9 text-foreground placeholder:text-muted-foreground/60",
                isPhoneValid && successInputCls
              )}
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
            {isPhoneValid && (
              <CheckIcon className={successIconCls} aria-hidden="true" />
            )}
          </div>
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
        <div className="relative">
          <Input
            id="email"
            type="email"
            placeholder="jan.novak@email.sk"
            className={cn(
              "h-11 bg-muted/30 pr-9 text-foreground placeholder:text-muted-foreground/60",
              isEmailValid && successInputCls
            )}
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
            aria-required
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {isEmailValid && (
            <CheckIcon className={successIconCls} aria-hidden="true" />
          )}
        </div>
        {touchedFields.email && errors.email && (
          <p id="email-error" className="text-[13px] font-medium text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Note — optional, collapsed by default to keep the form short.
          Visually de-emphasised so the user understands it's not required. */}
      {showNote ? (
        <div className="space-y-1.5">
          <Label htmlFor="note" className="text-[15px] font-medium text-foreground">
            Poznámka{" "}
            <span className="font-normal text-muted-foreground">
              (nepovinné)
            </span>
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
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 -ml-2 text-[14px] font-medium text-primary/85 transition-colors hover:text-primary hover:bg-primary/5"
        >
          <PlusIcon className="size-4" />
          Pridať poznámku (nepovinné)
        </button>
      )}

      <Button
        type="submit"
        className="h-12 w-full text-base font-semibold"
        size="lg"
        disabled={!canSubmit || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2Icon className="size-5 animate-spin" />
            Pokračovať...
          </>
        ) : (
          "Skontrolovať a odoslať"
        )}
      </Button>
    </form>
  );
}
