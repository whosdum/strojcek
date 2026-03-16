"use client";

import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

const STEPS = [
  { label: "Služba", href: "/book" },
  { label: "Barbier", href: "/book/barber" },
  { label: "Termín", href: "/book/datetime" },
  { label: "Údaje", href: "/book/details" },
  { label: "Potvrdenie", href: "/book/confirm" },
];

export function BookingSteps({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Postup rezervácie" className="mb-8">
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <li key={step.href} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    isCompleted &&
                      "bg-primary text-primary-foreground",
                    isCurrent &&
                      "bg-primary text-primary-foreground ring-2 ring-primary/30",
                    !isCompleted &&
                      !isCurrent &&
                      "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={cn(
                    "text-[0.65rem] font-medium leading-none",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mb-5 h-px flex-1",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
