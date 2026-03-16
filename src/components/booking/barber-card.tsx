"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRightIcon, UserIcon } from "lucide-react";

interface BarberCardProps {
  id: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  avatarUrl: string | null;
  serviceId: string;
}

export function BarberCard({
  id,
  firstName,
  lastName,
  bio,
  avatarUrl,
  serviceId,
}: BarberCardProps) {
  return (
    <Link href={`/book/datetime?serviceId=${serviceId}&barberId=${id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`${firstName} ${lastName}`}
                className="size-full object-cover"
              />
            ) : (
              <UserIcon className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">
              {firstName} {lastName}
            </h3>
            {bio && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                {bio}
              </p>
            )}
          </div>
          <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
