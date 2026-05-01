// Single source of truth for the shop's contact info / address.
// Used in emails, structured data, error messages, public pages.

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

// Lead-time before a slot can be booked (so a customer has time to arrive).
export const MIN_BOOKING_LEAD_MINUTES = 15;
