"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerInputSchema, type CustomerInput } from "@/lib/validators";
import { updateCustomer } from "@/server/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

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

type PhonePrefix = "+421" | "+420";

function splitPhone(phone: string): { prefix: PhonePrefix; digits: string } {
  if (phone.startsWith("+420")) return { prefix: "+420", digits: phone.slice(4) };
  if (phone.startsWith("+421")) return { prefix: "+421", digits: phone.slice(4) };
  return { prefix: "+421", digits: "" };
}

export function CustomerEditForm({ customer, onClose }: CustomerEditFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const initialPhone = splitPhone(customer.phone);
  const [phonePrefix, setPhonePrefix] = useState<PhonePrefix>(initialPhone.prefix);
  const [phoneDigits, setPhoneDigits] = useState<string>(initialPhone.digits);

  const {
    register,
    handleSubmit,
    setValue,
    setError: setFieldError,
    clearErrors,
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
    if (phoneDigits.length !== 9) {
      setFieldError("phone", { message: "Telefón musí mať 9 číslic." });
      return;
    }
    clearErrors("phone");
    const composedPhone = `${phonePrefix}${phoneDigits}`;
    const payload: CustomerInput = { ...data, phone: composedPhone };
    try {
      const result = await updateCustomer(customer.id, payload);
      if (result.success) {
        toast.success("Zákazník bol aktualizovaný");
        router.refresh();
        onClose();
      } else {
        toast.error("Nepodarilo sa aktualizovať zákazníka");
        setError(result.error || "Nastala chyba.");
      }
    } catch {
      toast.error("Nepodarilo sa aktualizovať zákazníka");
      setError("Nastala chyba.");
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
          <Input
            id="firstName"
            maxLength={50}
            aria-required
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            {...register("firstName")}
          />
          {errors.firstName && (
            <p id="firstName-error" className="text-xs text-destructive">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Priezvisko</Label>
          <Input id="lastName" maxLength={50} {...register("lastName")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phoneDigits">Telefón *</Label>
        <div className="flex gap-2">
          <Select
            value={phonePrefix}
            onValueChange={(v) => setPhonePrefix((v as PhonePrefix) ?? "+421")}
          >
            <SelectTrigger className="w-[112px] shrink-0">
              <SelectValue placeholder="+421" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="+421">+421 SK</SelectItem>
              <SelectItem value="+420">+420 CZ</SelectItem>
            </SelectContent>
          </Select>
          <Input
            id="phoneDigits"
            type="tel"
            inputMode="numeric"
            maxLength={9}
            placeholder="9XX XXX XXX"
            value={phoneDigits}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
              const cleaned = digits.startsWith("0") ? digits.slice(1) : digits;
              setPhoneDigits(cleaned);
              // Keep RHF's phone field in sync so server-side validation
              // sees the composed E.164 value if the form is submitted.
              setValue("phone", `${phonePrefix}${cleaned}`, {
                shouldValidate: false,
              });
            }}
            aria-required
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
            autoComplete="tel-national"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          9-miestne číslo bez úvodnej nuly (napr. 903123456).
        </p>
        {errors.phone && (
          <p id="phone-error" className="text-xs text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" maxLength={254} {...register("email")} />
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
