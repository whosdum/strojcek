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
  /** Keeps the section body rendered even after the section has moved
   *  to "completed" state. Used by step 3 (Dátum a čas) so the calendar
   *  + slot grid stay visible while the user is on the contact form —
   *  the date is editable in place instead of behind an edit pencil. */
  keepBodyVisible?: boolean;
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
      keepBodyVisible,
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
            isCompleted && "bg-primary/15 text-primary-strong",
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
            <p className="mt-0.5 truncate text-[15px] text-primary-strong font-medium">
              {completedSummary}
            </p>
          )}
        </div>

        {/* Edit icon (decorative — parent button handles interaction).
         *  Hidden when keepBodyVisible: the body IS the editor, no
         *  pencil-then-collapse roundtrip is needed. */}
        {isCompleted && onEdit && !keepBodyVisible && (
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
          >
            <PencilIcon className="size-4" />
          </span>
        )}
      </>
    );

    // When the section's body is kept visible past completion (e.g. step
    // 3's calendar persists into step 4), we don't want the inline edit
    // pencil — the body itself IS the editor — and we render the header
    // as a static div instead of a button.
    const bodyVisible = isActive || (isCompleted && Boolean(keepBodyVisible));
    const headerIsButton = isCompleted && !keepBodyVisible;

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
        {/* Vertical stepper connector — sits ONLY in the inter-section gap
            (and a few px into the next card's top padding to meet the
            next circle). Earlier we drew it from circle bottom all the
            way through the section interior, but with `keepBodyVisible`
            section 3 expands to ~600px and the line ran straight through
            the calendar grid. The gap-only positioning sidesteps that:
              - `-bottom-7` puts the line's bottom edge 28px below the
                section card.
              - `h-7` (28px) makes the top edge sit exactly on the
                section's bottom edge.
              - Visible portion: 12px (space-y-3 gap) + 16px (next card's
                p-4 top padding) = lands at the next circle's top.
              - left-[33px] aligns with the size-9 circle's vertical
                center (16px padding + 18px half-circle, minus 1px for
                the 2px line width). */}
        {hasNext && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[33px] -bottom-7 z-10 h-7 w-0.5 rounded-full bg-primary"
          />
        )}
        {/* Header */}
        {headerIsButton ? (
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
              bodyVisible && "pb-2"
            )}
          >
            {headerContent}
          </div>
        )}

        {/* Content */}
        {bodyVisible && <div className="px-4 pb-5 pt-1">{children}</div>}
      </section>
    );
  }
);
