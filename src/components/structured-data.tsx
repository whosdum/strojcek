interface OpeningHoursSpec {
  dayOfWeek: string;
  opens: string;
  closes: string;
}

interface StructuredDataProps {
  openingHours?: OpeningHoursSpec[];
  services?: { name: string; description: string; price: number }[];
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_HOURS: OpeningHoursSpec[] = [
  { dayOfWeek: "Monday", opens: "09:00", closes: "17:00" },
  { dayOfWeek: "Tuesday", opens: "09:00", closes: "17:00" },
  { dayOfWeek: "Wednesday", opens: "09:00", closes: "17:00" },
  { dayOfWeek: "Thursday", opens: "09:00", closes: "17:00" },
  { dayOfWeek: "Friday", opens: "09:00", closes: "17:00" },
  { dayOfWeek: "Saturday", opens: "09:00", closes: "13:00" },
];

export function StructuredData({ openingHours, services }: StructuredDataProps) {
  const hours = openingHours ?? DEFAULT_HOURS;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    name: "Strojček",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://strojcek.sk",
    logo: `${process.env.NEXT_PUBLIC_APP_URL || "https://strojcek.sk"}/logo.jpg`,
    image: `${process.env.NEXT_PUBLIC_APP_URL || "https://strojcek.sk"}/logo.jpg`,
    telephone: "+421944932871",
    email: "strojcekbarbershop@gmail.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Moyzesova 379/2",
      addressLocality: "Bytča",
      postalCode: "01401",
      addressCountry: "SK",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 49.2241,
      longitude: 18.5583,
    },
    priceRange: "€€",
    currenciesAccepted: "EUR",
    paymentAccepted: "Cash, Credit Card",
    openingHoursSpecification: hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.dayOfWeek,
      opens: h.opens,
      closes: h.closes,
    })),
    ...(services && services.length > 0
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Služby",
            itemListElement: services.map((s) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: s.name,
                description: s.description,
              },
              price: s.price,
              priceCurrency: "EUR",
            })),
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export { DAY_NAMES };
export type { OpeningHoursSpec };
