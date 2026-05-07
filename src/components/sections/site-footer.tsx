import Link from "next/link";
import { ContactHoursGrid } from "@/components/sections/contact-hours";

interface SiteFooterProps {
  hours: Array<{ dayOfWeek: string; opens: string; closes: string }>;
  className?: string;
}

export function SiteFooter({
  hours,
  className = "mt-12 rounded-2xl border border-border/40 bg-card/40 p-6 sm:p-8",
}: SiteFooterProps) {
  return (
    <footer>
      <section aria-label="Kontakt a otváracie hodiny" className={className}>
        <ContactHoursGrid hours={hours} />
      </section>

      <div className="mt-6 border-t border-border/40 pt-6 text-center text-[13px] text-muted-foreground">
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/vop"
            prefetch={false}
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Obchodné podmienky
          </Link>
          <span className="text-border">|</span>
          <Link
            href="/ochrana-udajov"
            prefetch={false}
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Ochrana osobných údajov
          </Link>
          <span className="text-border">|</span>
          <Link
            href="/o-nas"
            prefetch={false}
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            O nás
          </Link>
        </div>
        <p className="mt-2">
          © {new Date().getFullYear()} STROJČEK s.r.o.
        </p>
      </div>
    </footer>
  );
}
