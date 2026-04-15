"use client";

import { Loader2Icon } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Loader2Icon className="size-8 animate-spin text-primary" />
    </div>
  );
}
