export const dynamic = "force-dynamic";

import { getCachedActiveServices, getCachedActiveBarbersWithServices } from "@/server/queries/cached";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { BookingShell } from "@/components/booking/booking-shell";
import Image from "next/image";
import Link from "next/link";

export default async function HomePage() {
  const [services, barbers] = await Promise.all([
    getCachedActiveServices(),
    getCachedActiveBarbersWithServices(),
  ]);

  const serializedServices = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    price: s.price.toString(),
  }));

  return (
    <BookingShell>
      <header className="mb-6 flex flex-col items-center text-center sm:mb-8">
        <Image
          src="/logo.jpg"
          alt="Strojček"
          width={140}
          height={76}
          className="rounded-xl shadow-lg shadow-black/20"
          priority
        />
        <h1 className="mt-3 text-xl font-bold tracking-tight text-primary sm:text-2xl">
          Strojček
        </h1>
        <p className="mt-0.5 text-[13px] font-medium uppercase tracking-widest text-muted-foreground">
          Online rezervácia
        </p>
      </header>

      <BookingWizard services={serializedServices} barbers={barbers} />

      <footer className="mt-10 border-t border-border/40 pt-6 text-center text-[13px] text-muted-foreground">
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
        </div>
        <p className="mt-2">
          © {new Date().getFullYear()} STROJČEK s.r.o.
        </p>
      </footer>
    </BookingShell>
  );
}
