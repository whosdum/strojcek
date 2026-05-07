interface OpeningHour {
  dayOfWeek: string;
  opens: string;
  closes: string;
}

const SK_DAY_NAMES: Record<string, string> = {
  Monday: "Pondelok",
  Tuesday: "Utorok",
  Wednesday: "Streda",
  Thursday: "Štvrtok",
  Friday: "Piatok",
  Saturday: "Sobota",
  Sunday: "Nedeľa",
};

interface OpeningHoursListProps {
  hours: OpeningHour[];
  className?: string;
}

export function OpeningHoursList({
  hours,
  className = "mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[15px]",
}: OpeningHoursListProps) {
  if (hours.length === 0) {
    return (
      <p className="mt-3 text-[15px] text-muted-foreground">
        Otváracie hodiny sú k dispozícii v rezervačnom kalendári.
      </p>
    );
  }

  return (
    <dl className={className}>
      {hours.map((h) => (
        <div key={h.dayOfWeek} className="contents">
          <dt>{SK_DAY_NAMES[h.dayOfWeek] ?? h.dayOfWeek}</dt>
          <dd className="tabular-nums text-muted-foreground">
            {h.opens.slice(0, 5)} – {h.closes.slice(0, 5)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface OpeningHoursSectionProps {
  hours: OpeningHour[];
  className?: string;
}

export function OpeningHoursSection({
  hours,
  className = "mt-8 rounded-2xl border border-border/40 bg-card/40 p-6 sm:p-8",
}: OpeningHoursSectionProps) {
  return (
    <section aria-labelledby="otvaracie-hodiny" className={className}>
      <h2
        id="otvaracie-hodiny"
        className="text-lg font-bold tracking-tight sm:text-xl"
      >
        Otváracie hodiny
      </h2>
      <OpeningHoursList hours={hours} className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[15px]" />
    </section>
  );
}
