"use client";

import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PencilIcon, CheckIcon } from "lucide-react";

interface SectionWrapperProps {
  stepNumber: number;
  title: string;
  isActive: boolean;
  isCompleted: boolean;
  completedSummary?: string;
  onEdit?: () => void;
  children: ReactNode;
}

export const SectionWrapper = forwardRef<HTMLDivElement, SectionWrapperProps>(
  function SectionWrapper(
    {
      stepNumber,
      title,
      isActive,
      isCompleted,
      completedSummary,
      onEdit,
      children,
    },
    ref
  ) {
    const isLocked = !isActive && !isCompleted;

    return (
      <section
        ref={ref}
        className={cn(
          "scroll-mt-4 rounded-2xl border transition-all duration-200",
          isActive && "border-border/60 bg-card shadow-lg shadow-black/10",
          isCompleted && "border-border/40 bg-card/80",
          isLocked && "border-transparent bg-card/40 opacity-50"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl p-4 outline-none",
            isCompleted && "cursor-pointer active:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary/50",
            isActive && "pb-2"
          )}
          onClick={isCompleted ? onEdit : undefined}
          role={isCompleted ? "button" : undefined}
          tabIndex={isCompleted ? 0 : undefined}
          onKeyDown={
            isCompleted
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEdit?.();
                  }
                }
              : undefined
          }
        >
          {/* Step number circle */}
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
              isActive && "bg-primary text-primary-foreground shadow-sm",
              isCompleted && "bg-primary/15 text-primary",
              isLocked && "bg-muted/50 text-muted-foreground"
            )}
          >
            {isCompleted ? (
              <CheckIcon className="size-4.5" strokeWidth={2.5} />
            ) : (
              stepNumber
            )}
          </div>

          {/* Title + summary */}
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                "font-semibold leading-tight",
                isActive && "text-[17px] text-foreground",
                isCompleted && "text-[15px] text-foreground/90",
                isLocked && "text-[15px] text-muted-foreground"
              )}
            >
              {title}
            </h2>
            {isCompleted && completedSummary && (
              <p className="mt-0.5 truncate text-[15px] text-primary font-medium">
                {completedSummary}
              </p>
            )}
          </div>

          {/* Edit button */}
          {isCompleted && onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              aria-label={`Upraviť ${title}`}
            >
              <PencilIcon className="size-4" />
            </button>
          )}
        </div>

        {/* Content */}
        {isActive && <div className="px-4 pb-5 pt-1">{children}</div>}
      </section>
    );
  }
);
