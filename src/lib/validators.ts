import { z } from "zod";

/** Lowercase + trim emails before validation so casing/whitespace cannot
 *  produce duplicate customer records. */
const normalizeEmail = (val: unknown): unknown =>
  typeof val === "string" ? val.trim().toLowerCase() : val;

/** Foreign-key id validator. Firestore generates 20-char auto-IDs;
 *  scripts use crypto.randomUUID() (RFC-4122 v4). Existence is verified
 *  by Firestore reads, not by structural format, so we just bound the
 *  shape. Slashes are forbidden because they would path-traverse into a
 *  subcollection when interpolated into doc paths. */
const fkId = () =>
  z
    .string()
    .min(1, "ID je povinné")
    .max(64, "ID je príliš dlhé")
    .regex(/^[A-Za-z0-9_-]+$/, "Neplatné ID");

/** HH:MM format, validates hours 00-23 and minutes 00-59 */
const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Neplatný formát času (HH:MM)")
  .refine((val) => {
    const [h, m] = val.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, "Neplatný čas");

export const bookingInputSchema = z.object({
  serviceId: fkId(),
  barberId: fkId(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: timeString,
  firstName: z
    .string()
    .min(1, "Meno je povinné")
    .max(50, "Meno môže mať najviac 50 znakov"),
  lastName: z
    .string()
    .min(1, "Priezvisko je povinné")
    .max(50, "Priezvisko môže mať najviac 50 znakov"),
  phone: z
    .string()
    .min(1, "Telefón je povinný")
    .regex(/^\+4(20|21)\d{9}$/, "Neplatné telefónne číslo"),
  email: z.preprocess(
    normalizeEmail,
    z
      .string()
      .min(1, "Email je povinný")
      .email("Zadajte platný email")
      .max(254, "Email môže mať najviac 254 znakov")
  ),
  note: z
    .string()
    .max(500, "Poznámka môže mať najviac 500 znakov")
    .optional()
    .default(""),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;

export const cancelBookingInputSchema = z.object({
  // generateToken() emits 32 random bytes hex-encoded → exactly 64 hex
  // chars; hashToken() (sha256 hex) is the same shape. A strict regex
  // rejects junk strings upfront so they don't burn Firestore reads
  // looking for impossible-format tokens.
  token: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "Neplatný odkaz na zrušenie"),
  reason: z
    .string()
    .trim()
    .max(500, "Dôvod zrušenia môže mať najviac 500 znakov")
    .optional()
    .default(""),
});

export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;

export const serviceInputSchema = z.object({
  name: z.string().min(1, "Názov je povinný"),
  description: z.string().optional().default(""),
  durationMinutes: z.coerce.number().min(5).max(480),
  price: z.coerce.number().min(0),
  bufferMinutes: z.coerce.number().min(0).max(60).default(5),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().default(0),
});

export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const barberInputSchema = z.object({
  firstName: z.string().min(1, "Meno je povinné"),
  lastName: z.string().min(1, "Priezvisko je povinné"),
  email: z.preprocess(
    normalizeEmail,
    z.string().email().optional().or(z.literal(""))
  ),
  phone: z.string().optional().default(""),
  bio: z.string().optional().default(""),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().default(0),
  bookingHorizonWeeks: z.coerce
    .number()
    .int("Musí byť celé číslo")
    .min(1, "Najmenej 1 týždeň")
    .max(26, "Najviac 26 týždňov")
    .default(3),
});

export type BarberInput = z.infer<typeof barberInputSchema>;

export const overrideInputSchema = z
  .object({
    barberId: fkId(),
    overrideDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný dátum"),
    isAvailable: z.boolean(),
    startTime: timeString.nullable().optional(),
    endTime: timeString.nullable().optional(),
    reason: z
      .string()
      .trim()
      .max(200, "Maximálne 200 znakov")
      .optional()
      .default(""),
    force: z.boolean().optional().default(false),
  })
  .refine(
    (d) => !d.isAvailable || (!!d.startTime && !!d.endTime),
    {
      message: "Pri vlastných hodinách musia byť zadané obe časy",
      path: ["endTime"],
    }
  )
  .refine(
    (d) =>
      !d.isAvailable ||
      !d.startTime ||
      !d.endTime ||
      d.startTime < d.endTime,
    { message: "Koniec musí byť po začiatku", path: ["endTime"] }
  );

export type OverrideInput = z.infer<typeof overrideInputSchema>;

export const scheduleInputSchema = z
  .object({
    barberId: fkId(),
    dayOfWeek: z.coerce.number().min(0).max(6),
    startTime: timeString,
    endTime: timeString,
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Koniec musí byť po začiatku",
    path: ["endTime"],
  });

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export const breakInputSchema = z
  .object({
    barberId: fkId(),
    dayOfWeek: z.coerce.number().min(0).max(6),
    startTime: timeString,
    endTime: timeString,
    label: z.string().default("Prestávka"),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Koniec musí byť po začiatku",
    path: ["endTime"],
  });

export type BreakInput = z.infer<typeof breakInputSchema>;

export const customerInputSchema = z.object({
  firstName: z
    .string()
    .min(1, "Meno je povinné")
    .max(50, "Meno môže mať najviac 50 znakov"),
  lastName: z
    .string()
    .max(50, "Priezvisko môže mať najviac 50 znakov")
    .optional()
    .default(""),
  phone: z.string().min(1, "Telefón je povinný").regex(/^\+4(20|21)\d{9}$/, "Neplatné telefónne číslo"),
  email: z.preprocess(
    normalizeEmail,
    z
      .string()
      .email()
      .max(254, "Email môže mať najviac 254 znakov")
      .optional()
      .or(z.literal(""))
  ),
  notes: z
    .string()
    .max(1000, "Poznámka môže mať najviac 1000 znakov")
    .optional()
    .default(""),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

/** Walk-in / blocked-time appointments don't have a customer record
 *  attached — admin uses them for in-person walk-ups whose contact
 *  details aren't known, or to block their own time on the calendar.
 *  Contact fields are skipped; only an optional label survives. */
const adminAppointmentBaseSchema = z.object({
  serviceId: fkId(),
  barberId: fkId(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný dátum"),
  time: timeString,
  firstName: z
    .string()
    .max(50, "Meno môže mať najviac 50 znakov")
    .optional()
    .default(""),
  lastName: z
    .string()
    .max(50, "Priezvisko môže mať najviac 50 znakov")
    .optional()
    .default(""),
  phone: z.string().optional().default(""),
  email: z.preprocess(
    normalizeEmail,
    z
      .string()
      .max(254, "Email môže mať najviac 254 znakov")
      .optional()
      .or(z.literal(""))
  ),
  notes: z
    .string()
    .max(1000, "Poznámka môže mať najviac 1000 znakov")
    .optional()
    .default(""),
  ignoreSchedule: z.boolean().default(false),
  walkIn: z.boolean().default(false),
  /** Free-form label shown in admin lists when walkIn=true. Empty
   *  defaults to "Walk-in" at the action layer. */
  label: z
    .string()
    .max(100, "Popis môže mať najviac 100 znakov")
    .optional()
    .default(""),
});

const E164_PHONE_RE = /^\+4(20|21)\d{9}$/;

/** Refine: contact fields are required only when walkIn is false.
 *  Walk-in entries store no PII so the booking action can short-circuit
 *  notifications, customer upsert, and rate-limit counters. */
function requireContactWhenNotWalkIn(
  data: { walkIn: boolean; firstName?: string; phone?: string; email?: string | undefined },
  ctx: z.RefinementCtx,
  emailRequired: boolean
) {
  if (data.walkIn) return;
  if (!data.firstName || data.firstName.trim().length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["firstName"],
      message: "Meno je povinné",
    });
  }
  if (!data.phone || !E164_PHONE_RE.test(data.phone)) {
    ctx.addIssue({
      code: "custom",
      path: ["phone"],
      message: "Neplatné telefónne číslo",
    });
  }
  if (emailRequired) {
    if (!data.email || data.email.length === 0) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email je povinný" });
    }
  }
}

export const adminAppointmentInputSchema = adminAppointmentBaseSchema.superRefine(
  (data, ctx) => requireContactWhenNotWalkIn(data, ctx, true)
);

export type AdminAppointmentInput = z.infer<typeof adminAppointmentInputSchema>;

export const adminAppointmentEditSchema = adminAppointmentBaseSchema
  .extend({
    priceFinal: z
      .union([z.coerce.number().min(0), z.literal(""), z.null()])
      .optional(),
  })
  // Edit allows empty email — legacy reservations that pre-date the
  // required-email rule shouldn't fail validation just because admin
  // is saving a notes change.
  .superRefine((data, ctx) => requireContactWhenNotWalkIn(data, ctx, false));

export type AdminAppointmentEditInput = z.infer<typeof adminAppointmentEditSchema>;
