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
  /** When true, briefly highlight the section with a primary ring — used
   *  to confirm an auto-advance to the user (we just registered your
   *  selection). Wizard sets this for ~700ms after a step completes. */
  isFlashing?: boolean;
  /** When true, render the vertical stepper connector line below this
   *  section's number circle, bridging the inter-card gap to the next
   *  rendered section. Only set for sections whose successor is also
   *  visible (i.e., `state.step > stepNumber`). */
  hasNext?: boolean;
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
      isFlashing,
      hasNext,
      children,
    },
    ref
  ) {
    const isLocked = !isActive && !isCompleted;

    const headerContent = (
      <>
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
        <div className="min-w-0 flex-1 text-left">
          <span
            className={cn(
              "block font-semibold leading-tight",
              isActive && "text-[17px] text-foreground",
              isCompleted && "text-[15px] text-foreground/90",
              isLocked && "text-[15px] text-muted-foreground"
            )}
          >
            {title}
          </span>
          {isCompleted && completedSummary && (
            <p className="mt-0.5 truncate text-[15px] text-primary font-medium">
              {completedSummary}
            </p>
          )}
        </div>

        {/* Edit icon (decorative — parent button handles interaction) */}
        {isCompleted && onEdit && (
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
          >
            <PencilIcon className="size-4" />
          </span>
        )}
      </>
    );

    return (
      <section
        ref={ref}
        aria-current={isActive ? "step" : undefined}
        className={cn(
          "relative scroll-mt-6 rounded-2xl border transition-all duration-700",
          isActive && "border-border/60 bg-card shadow-lg shadow-black/10",
          isCompleted && "border-border/40 bg-card/80",
          isLocked && "border-transparent bg-card/40 opacity-50",
          isFlashing && "ring-2 ring-primary/60 bg-primary/[0.06]"
        )}
      >
        {/* Vertical stepper connector — bridges this section's number
            circle to the next section's circle through the inter-card gap.
            Geometry:
              - Circle center X = p-4 (16) + size-9/2 (18) = 34px from card edge
              - w-0.5 line is 2px wide → left = 34 - 1 = 33px
              - Circle bottom Y = 16 + 36 = 52px from card top
              - Next card's circle top Y = 16px from its own top
              - With space-y-3 between cards (12px gap) the line spans
                from current card's `top-[52px]` past `-bottom-7` (-28px)
                so it ends 12px (gap) + 16px (next-card top padding) below
                the current card edge — exactly at the next circle's top.
            Always rendered in primary because `hasNext` is only true once
            the user has progressed past this step, i.e. it's completed. */}
        {hasNext && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[33px] top-[52px] -bottom-7 z-10 w-0.5 rounded-full bg-primary"
          />
        )}
        {/* Header */}
        {isCompleted ? (
          <button
            type="button"
            aria-label={`Upraviť krok ${stepNumber}: ${title}`}
            className="flex w-full items-center gap-3 rounded-xl p-4 outline-none cursor-pointer active:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary/50"
            onClick={onEdit}
          >
            {headerContent}
          </button>
        ) : (
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl p-4 outline-none",
              isActive && "pb-2"
            )}
          >
            {headerContent}
          </div>
        )}

        {/* Content */}
        {isActive && <div className="px-4 pb-5 pt-1">{children}</div>}
      </section>
    );
  }
);
