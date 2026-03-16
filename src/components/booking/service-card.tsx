"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ClockIcon, ChevronRightIcon } from "lucide-react";

interface ServiceCardProps {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number | string;
}

export function ServiceCard({
  id,
  name,
  description,
  durationMinutes,
  price,
}: ServiceCardProps) {
  const priceNum = typeof price === "string" ? parseFloat(price) : price;

  return (
    <Link href={`/book/barber?serviceId=${id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{name}</h3>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <ClockIcon className="size-3.5" />
                {durationMinutes} min
              </span>
              <span className="font-semibold text-foreground">
                {priceNum.toFixed(2)} €
              </span>
            </div>
          </div>
          <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
