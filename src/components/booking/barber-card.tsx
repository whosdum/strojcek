"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CheckIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BarberCardProps {
  id: string;
  firstName: string;
  lastName: string;
  bio: string | null;
  avatarUrl: string | null;
  onClick?: () => void;
  isSelected?: boolean;
}

export function BarberCard({
  id,
  firstName,
  lastName,
  bio,
  avatarUrl,
  onClick,
  isSelected,
}: BarberCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-md",
        isSelected && "border-l-4 border-primary bg-primary/10"
      )}
      onClick={onClick}
    >
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
        {isSelected && (
          <CheckIcon className="size-5 shrink-0 text-primary" />
        )}
      </CardContent>
    </Card>
  );
}
