import Image from "next/image";
import Link from "next/link";
import { getActiveServices } from "@/server/queries/services";
import { getAllBarbersWithSchedules } from "@/server/queries/barbers";
import {
  ScissorsIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  CalendarCheckIcon,
  InstagramIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingShell } from "@/components/landing-shell";

const DAY_LABELS = [
  "Nedeľa",
  "Pondelok",
  "Utorok",
  "Streda",
  "Štvrtok",
  "Piatok",
  "Sobota",
];

export default async function HomePage() {
  const [services, barbers] = await Promise.all([
    getActiveServices(),
    getAllBarbersWithSchedules(),
  ]);

  const barber = barbers[0];
  const schedules = barber?.schedules ?? [];

  return (
    <LandingShell>
      {/* Hero */}
      <section className="flex flex-col items-center px-4 pb-10 pt-12 text-center sm:pb-14 sm:pt-16">
        <Image
          src="/logo.jpg"
          alt="Strojček"
          width={160}
          height={87}
          className="rounded-xl shadow-lg shadow-black/20"
          priority
        />
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          Strojček
        </h1>
        <p className="mt-1 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Barbershop Bytča
        </p>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Profesionálny pánsky barbershop v centre Bytče. Strih, brada, hot
          towel rituál — všetko na jednom mieste.
        </p>
        <Link href="/book" className="mt-6">
          <Button size="lg" className="gap-2 px-8 text-base font-semibold">
            <CalendarCheckIcon className="size-5" />
            Rezervovať termín
          </Button>
        </Link>
      </section>

      {/* Services */}
      <section className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-center text-xl font-bold sm:text-2xl">
            Služby
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/80 p-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <ScissorsIcon className="size-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold leading-tight">{s.name}</h3>
                    <span className="shrink-0 text-sm font-bold text-primary">
                      {Number(s.price)} €
                    </span>
                  </div>
                  {s.description && (
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                      {s.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <ClockIcon className="size-3.5" />
                    {s.durationMinutes} min
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/book">
              <Button variant="outline" className="gap-2">
                <CalendarCheckIcon className="size-4" />
                Rezervovať online
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Barber */}
      {barber && (
        <section id="o-nas" className="px-4 py-10 sm:py-14">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-center text-xl font-bold sm:text-2xl">
              Váš barbier
            </h2>
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/40 bg-card/80 p-6 text-center sm:flex-row sm:text-left">
              {barber.avatarUrl ? (
                <Image
                  src={barber.avatarUrl}
                  alt={`${barber.firstName} ${barber.lastName}`}
                  width={96}
                  height={96}
                  className="size-24 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-full bg-primary/10">
                  <ScissorsIcon className="size-10 text-primary" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold">
                  {barber.firstName} {barber.lastName}
                </h3>
                {barber.bio && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {barber.bio}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Opening hours */}
      <section className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-center text-xl font-bold sm:text-2xl">
            Otváracie hodiny
          </h2>
          <div className="mx-auto max-w-sm rounded-2xl border border-border/40 bg-card/80 p-5">
            <div className="space-y-2">
              {DAY_LABELS.map((label, dayIndex) => {
                const schedule = schedules.find(
                  (s) => s.dayOfWeek === dayIndex && s.isActive
                );
                const today = new Date().getDay();
                const isToday = today === dayIndex;

                return (
                  <div
                    key={dayIndex}
                    className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                      isToday
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-foreground"
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={
                        schedule
                          ? ""
                          : "text-muted-foreground"
                      }
                    >
                      {schedule
                        ? `${schedule.startTime} — ${schedule.endTime}`
                        : "Zatvorené"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-center text-xl font-bold sm:text-2xl">
            Kontakt
          </h2>
          <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border/40 bg-card/80 p-5">
            <a
              href="https://maps.app.goo.gl/xYANzT31jAz3viW37"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-muted/50"
            >
              <MapPinIcon className="size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Adresa</p>
                <p className="text-sm text-muted-foreground">
                  Moyzesova 379/2, 014 01 Bytča
                </p>
              </div>
            </a>
            <div className="flex items-center gap-3 p-1">
              <PhoneIcon className="size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Telefón</p>
                <a
                  href="tel:+421944932871"
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  +421 944 932 871
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3 p-1">
              <MailIcon className="size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Email</p>
                <a
                  href="mailto:strojcekbarbershop@gmail.com"
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  strojcekbarbershop@gmail.com
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3 p-1">
              <InstagramIcon className="size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Instagram</p>
                <a
                  href="https://instagram.com/strojcek_barbershop"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  @strojcek_barbershop
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-10 text-center sm:py-14">
        <h2 className="text-xl font-bold sm:text-2xl">
          Pripravený na nový look?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Rezervujte si termín online za pár sekúnd. Bez volania, bez čakania.
        </p>
        <Link href="/book" className="mt-5 inline-block">
          <Button size="lg" className="gap-2 px-8 text-base font-semibold">
            <CalendarCheckIcon className="size-5" />
            Rezervovať teraz
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 px-4 py-6 text-center text-[13px] text-muted-foreground">
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/vop"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Obchodné podmienky
          </Link>
          <span className="text-border">|</span>
          <Link
            href="/ochrana-udajov"
            className="underline-offset-2 hover:text-foreground hover:underline"
          >
            Ochrana osobných údajov
          </Link>
        </div>
        <p className="mt-2">
          © {new Date().getFullYear()} STROJČEK s.r.o. | IČO: 57286477
        </p>
      </footer>
    </LandingShell>
  );
}
