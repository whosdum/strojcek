import {
  PUBLIC_SITE_URL,
  SHOP_NAME,
  SHOP_LEGAL_NAME,
  SHOP_PHONE_E164,
  SHOP_EMAIL,
  SHOP_STREET,
  SHOP_CITY,
  SHOP_POSTAL_CODE,
  SHOP_COUNTRY,
  SHOP_GEO,
  SHOP_MAPS_URL,
  SHOP_SOCIAL_PROFILES,
} from "@/lib/business-info";

interface OpeningHoursSpec {
  dayOfWeek: string;
  opens: string;
  closes: string;
}

interface StructuredDataProps {
  openingHours?: OpeningHoursSpec[];
  services?: { name: string; description: string; price: number }[];
}

const DEFAULT_HOURS: OpeningHoursSpec[] = [
  { dayOfWeek: "Monday", opens: "09:00", closes: "17:00" },
  { dayOfWeek: "Tuesday", opens: "09:00", closes: "17:00" },
  { dayOfWeek: "Wednesday", opens: "09:00", closes: "17:00" },
  { dayOfWeek: "Thursday", opens: "09:00", closes: "17:00" },
  { dayOfWeek: "Friday", opens: "09:00", closes: "17:00" },
  { dayOfWeek: "Saturday", opens: "09:00", closes: "13:00" },
];

export function StructuredData({ openingHours, services }: StructuredDataProps) {
  // Empty array is a valid signal of "no schedule yet" — fall back only
  // when caller didn't supply anything at all.
  const hours =
    openingHours && openingHours.length > 0 ? openingHours : DEFAULT_HOURS;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": ["BarberShop", "HairSalon"],
    name: "Strojček Barbershop",
    alternateName: SHOP_NAME,
    legalName: SHOP_LEGAL_NAME,
    url: PUBLIC_SITE_URL,
    logo: `${PUBLIC_SITE_URL}/logo.jpg`,
    image: `${PUBLIC_SITE_URL}/logo.jpg`,
    telephone: SHOP_PHONE_E164,
    email: SHOP_EMAIL,
    address: {
      "@type": "PostalAddress",
      streetAddress: SHOP_STREET,
      addressLocality: SHOP_CITY,
      postalCode: SHOP_POSTAL_CODE,
      addressCountry: SHOP_COUNTRY,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: SHOP_GEO.lat,
      longitude: SHOP_GEO.lng,
    },
    hasMap: SHOP_MAPS_URL,
    areaServed: [
      { "@type": "City", name: "Bytča" },
      { "@type": "City", name: "Predmier" },
      { "@type": "City", name: "Hričovské Podhradie" },
      { "@type": "City", name: "Súľov-Hradná" },
      { "@type": "City", name: "Považská Bystrica" },
      { "@type": "City", name: "Žilina" },
      { "@type": "AdministrativeArea", name: "okres Bytča" },
      { "@type": "AdministrativeArea", name: "Žilinský kraj" },
    ],
    sameAs: SHOP_SOCIAL_PROFILES,
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

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${PUBLIC_SITE_URL}/#organization`,
    name: SHOP_LEGAL_NAME,
    alternateName: ["Strojček Barbershop", SHOP_NAME],
    legalName: SHOP_LEGAL_NAME,
    url: PUBLIC_SITE_URL,
    logo: `${PUBLIC_SITE_URL}/logo.jpg`,
    image: `${PUBLIC_SITE_URL}/logo.jpg`,
    address: {
      "@type": "PostalAddress",
      streetAddress: SHOP_STREET,
      addressLocality: SHOP_CITY,
      postalCode: SHOP_POSTAL_CODE,
      addressCountry: SHOP_COUNTRY,
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: SHOP_PHONE_E164,
      email: SHOP_EMAIL,
      contactType: "customer service",
      areaServed: "SK",
      availableLanguage: ["sk"],
    },
    sameAs: SHOP_SOCIAL_PROFILES,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
      />
    </>
  );
}

export type { OpeningHoursSpec };
