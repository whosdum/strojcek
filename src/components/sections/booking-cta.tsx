"use client";

import { CalendarCheckIcon } from "lucide-react";

export function BookingCta() {
  // Plain anchor links (href="#rezervacia-heading") don't scroll if the URL
  // already has that hash — common when the user just navigated through the
  // page or when /?service=X resolves with a hash. Programmatic scroll fixes
  // this and also gives us smooth-scroll behavior on every click.
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const target = document.getElementById("rezervacia-heading");
    if (!target) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section
      aria-label="Rezervácia"
      className="mt-12 flex flex-col items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary/[0.06] px-5 py-7 text-center sm:py-8"
    >
      <h2 className="text-lg font-bold tracking-tight sm:text-xl">
        Pripravený na nový strih?
      </h2>
      <p className="max-w-sm text-[14px] text-muted-foreground sm:text-[15px]">
        Vyberte si termín online — len pár klikov a máte rezerváciu.
      </p>
      <a
        href="#rezervacia-heading"
        onClick={handleClick}
        className="mt-1 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.98] sm:text-[16px]"
      >
        <CalendarCheckIcon className="size-4" />
        Rezervovať termín
      </a>
    </section>
  );
}
