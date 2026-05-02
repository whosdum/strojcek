"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import type { ReactNode, MouseEvent } from "react";

/**
 * Whole-row clickable wrapper for admin list tables. Clicking any empty
 * space inside the row navigates to `href`; clicks on inner links/buttons
 * keep their own behaviour. Cursor + hover bg make the affordance visible.
 */
export function ClickableTableRow({
  href,
  children,
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const router = useRouter();

  const onClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      if ((e.target as HTMLElement).closest("a,button")) return;
      e.preventDefault();
      router.push(href);
    }
  };

  // No `role="link"` on the row — it contains nested <Link>/<Button>
  // elements (eye icon, edit pencil) and screen readers were announcing
  // the outer link with inner links nested inside it. The row stays
  // keyboard-activatable via tabIndex + Enter/Space and is described by
  // its aria-label; inner links keep their own semantics.
  return (
    <TableRow
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-label={ariaLabel ?? "Otvoriť detail"}
      className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {children}
    </TableRow>
  );
}
