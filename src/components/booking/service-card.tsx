"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CheckIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceCardProps {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number | string;
  onClick?: () => void;
  isSelected?: boolean;
}

export function ServiceCard({
  name,
  description,
  durationMinutes,
  price,
  onClick,
  isSelected,
}: ServiceCardProps) {
  const priceNum = typeof price === "string" ? parseFloat(price) : price;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-md",
        isSelected && "border-l-4 border-primary bg-primary/10"
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{name}</h3>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              {durationMinutes} min
            </span>
            <span className="font-semibold text-foreground">
              {priceNum.toFixed(2)} €
            </span>
          </div>
        </div>
        {isSelected && (
          <CheckIcon className="size-5 shrink-0 text-primary" />
        )}
      </CardContent>
    </Card>
  );
}
