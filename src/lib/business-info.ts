// Single source of truth for the shop's contact info / address.
// Used in emails, structured data, error messages, public pages.

/**
 * Canonical public URL the customer always sees — used in outbound
 * emails (cancel link, "new booking" CTA), OG/Twitter metadata,
 * sitemap.xml, robots.txt and JSON-LD structured data.
 *
 * Distinct from process.env.NEXT_PUBLIC_APP_URL on purpose: that one
 * resolves to the *current deployment's* origin (e.g. the staging
 * `*.hosted.app` URL), which would leak hosting infrastructure URLs
 * into search-engine indexes and social previews. The auth same-origin
 * guard still uses NEXT_PUBLIC_APP_URL because that one needs to match
 * the actual request host, not the public branding.
 *
 * EMAIL_PUBLIC_URL env var lets local dev override this (e.g. point
 * cancel links at http://localhost:3000) without touching code.
 */
export const PUBLIC_SITE_URL =
  process.env.EMAIL_PUBLIC_URL || "https://strojcekbarbershop.sk";

export const SHOP_NAME = "Strojček";
export const SHOP_LEGAL_NAME = "STROJČEK s.r.o.";
export const SHOP_PHONE_E164 = "+421944932871";
export const SHOP_PHONE_DISPLAY = "0944 932 871";
export const SHOP_EMAIL = "strojcekbarbershop@gmail.com";
export const SHOP_STREET = "Moyzesova 379/2";
export const SHOP_CITY = "Bytča";
export const SHOP_POSTAL_CODE = "01401";
export const SHOP_COUNTRY = "SK";
export const SHOP_ADDRESS_FULL = `${SHOP_STREET}, 014 01 ${SHOP_CITY}`;

export const SHOP_GEO = { lat: 49.2241, lng: 18.5583 } as const;

// Google Maps place link — used in JSON-LD `hasMap` and any "Otvoriť
// v Mapách" CTA. Canonical short share URL (resolves to the listing,
// not a directions form).
export const SHOP_MAPS_URL = "https://maps.app.goo.gl/vycGoAym3oHEzN649";

// Authoritative external profiles. Used in schema.org `sameAs` so search
// engines can connect this entity across platforms (Knowledge Panel,
// Local Pack consolidation).
export const SHOP_SOCIAL_PROFILES = [
  "https://www.instagram.com/strojcek_/",
  "https://www.facebook.com/p/Stroj%C4%8Dek-61576655767286/",
] as const;

// Lead-time before a slot can be booked (so a customer has time to arrive).
export const MIN_BOOKING_LEAD_MINUTES = 15;
