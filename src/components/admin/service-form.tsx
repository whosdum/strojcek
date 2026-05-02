"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { serviceInputSchema, type ServiceInput } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createService, updateService } from "@/server/actions/services";
import { toast } from "sonner";

interface ServiceFormProps {
  service?: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    price: number | string;
    bufferMinutes: number;
    isActive: boolean;
    sortOrder: number;
  };
  onClose?: () => void;
}

export function ServiceForm({ service, onClose }: ServiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const isEdit = !!service;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ServiceInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(serviceInputSchema) as any,
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      durationMinutes: service?.durationMinutes ?? 30,
      price: typeof service?.price === "string" ? parseFloat(service.price) : (service?.price ?? 0),
      bufferMinutes: service?.bufferMinutes ?? 5,
      isActive: service?.isActive ?? true,
      sortOrder: service?.sortOrder ?? 0,
    },
  });

  const onSubmit = (data: ServiceInput) => {
    startTransition(async () => {
      try {
        const result = isEdit
          ? await updateService(service.id, data)
          : await createService(data);
        if (result.success) {
          toast.success("Služba bola uložená");
          router.refresh();
          onClose?.();
        } else {
          toast.error("Nepodarilo sa uložiť službu");
        }
      } catch {
        toast.error("Nepodarilo sa uložiť službu");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Názov *</Label>
        <Input
          id="name"
          aria-required
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
        {errors.name && (
          <p id="name-error" className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Popis</Label>
        <Textarea id="description" rows={2} {...register("description")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="durationMinutes">Trvanie (min)</Label>
          <Input
            id="durationMinutes"
            type="number"
            aria-invalid={!!errors.durationMinutes}
            aria-describedby={errors.durationMinutes ? "durationMinutes-error" : undefined}
            {...register("durationMinutes")}
          />
          {errors.durationMinutes && (
            <p id="durationMinutes-error" className="text-xs text-destructive">{errors.durationMinutes.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Cena (€)</Label>
          {/* Type=text + inputmode=decimal so SK users can type "15,50".
              setValueAs normalises the comma to a dot before Zod
              coerces. type=number rejects a comma in most browsers. */}
          <Input
            id="price"
            type="text"
            inputMode="decimal"
            {...register("price", {
              setValueAs: (v) =>
                typeof v === "string" ? v.replace(",", ".") : v,
            })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bufferMinutes">Buffer (min)</Label>
          <Input
            id="bufferMinutes"
            type="number"
            {...register("bufferMinutes")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sortOrder">Poradie</Label>
        <Input id="sortOrder" type="number" {...register("sortOrder")} />
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
        <Label htmlFor="isActive">Aktívna</Label>
      </div>

      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        {onClose && (
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Zrušiť
          </Button>
        )}
        <Button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {isEdit ? "Uložiť" : "Vytvoriť"}
        </Button>
      </div>
    </form>
  );
}
