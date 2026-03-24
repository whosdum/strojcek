"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { barberInputSchema, type BarberInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBarber, updateBarber, updateBarberServices } from "@/server/actions/barbers";

interface Service {
  id: string;
  name: string;
}

interface BarberFormProps {
  barber?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    bio: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    sortOrder: number;
    services: { serviceId: string }[];
  };
  allServices: Service[];
}

export function BarberForm({ barber, allServices }: BarberFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(barber?.isActive ?? true);
  const isEdit = !!barber;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<BarberInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(barberInputSchema) as any,
    defaultValues: {
      firstName: barber?.firstName ?? "",
      lastName: barber?.lastName ?? "",
      email: barber?.email ?? "",
      phone: barber?.phone ?? "",
      bio: barber?.bio ?? "",
      avatarUrl: barber?.avatarUrl ?? "",
      isActive: barber?.isActive ?? true,
      sortOrder: barber?.sortOrder ?? 0,
    },
  });

  const selectedServiceIds = barber?.services.map((s) => s.serviceId) ?? [];
  const [serviceIds, setServiceIds] = useState(selectedServiceIds);

  const onSubmit = (data: BarberInput) => {
    startTransition(async () => {
      let result;
      if (isEdit) {
        result = await updateBarber(barber.id, data);
        if (result.success) {
          await updateBarberServices(barber.id, serviceIds);
        }
      } else {
        result = await createBarber(data);
      }
      if (result.success) {
        router.push("/admin/barbers");
        router.refresh();
      }
    });
  };

  const toggleService = (id: string) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Meno *</Label>
          <Input id="firstName" {...register("firstName")} />
          {errors.firstName && (
            <p className="text-xs text-destructive">{errors.firstName.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Priezvisko *</Label>
          <Input id="lastName" {...register("lastName")} />
          {errors.lastName && (
            <p className="text-xs text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register("email")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefón</Label>
        <Input id="phone" {...register("phone")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" rows={3} {...register("bio")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="avatarUrl">Avatar URL</Label>
        <Input id="avatarUrl" {...register("avatarUrl")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sortOrder">Poradie</Label>
        <Input
          id="sortOrder"
          type="number"
          {...register("sortOrder")}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={(v) => {
            setIsActive(v);
            setValue("isActive", v);
          }}
        />
        <Label htmlFor="isActive">Aktívny</Label>
      </div>

      {allServices.length > 0 && (
        <div className="space-y-2">
          <Label>Služby</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {allServices.map((service) => (
              <div key={service.id} className="flex items-center gap-2">
                <Checkbox
                  id={`service-${service.id}`}
                  checked={serviceIds.includes(service.id)}
                  onCheckedChange={() => toggleService(service.id)}
                />
                <Label htmlFor={`service-${service.id}`} className="font-normal">
                  {service.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
        {isEdit ? "Uložiť" : "Vytvoriť"}
      </Button>
    </form>
  );
}
