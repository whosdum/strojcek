import { z } from "zod";

/** HH:MM format, validates hours 00-23 and minutes 00-59 */
const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Neplatný formát času (HH:MM)")
  .refine((val) => {
    const [h, m] = val.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, "Neplatný čas");

export const bookingInputSchema = z.object({
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: timeString,
  firstName: z.string().min(1, "Meno je povinné"),
  lastName: z.string().min(1, "Priezvisko je povinné"),
  phone: z
    .string()
    .min(1, "Telefón je povinný")
    .regex(/^\+4(20|21)\d{9}$/, "Neplatné telefónne číslo"),
  email: z.string().min(1, "Email je povinný").email("Zadajte platný email"),
  note: z.string().optional().default(""),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;

export const cancelBookingInputSchema = z.object({
  token: z.string().min(1, "Neplatný odkaz na zrušenie"),
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
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().default(""),
  bio: z.string().optional().default(""),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().default(0),
});

export type BarberInput = z.infer<typeof barberInputSchema>;

export const scheduleInputSchema = z
  .object({
    barberId: z.string().uuid(),
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
    barberId: z.string().uuid(),
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
  firstName: z.string().min(1, "Meno je povinné"),
  lastName: z.string().optional().default(""),
  phone: z.string().min(1, "Telefón je povinný").regex(/^\+4(20|21)\d{9}$/, "Neplatné telefónne číslo"),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional().default(""),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;

export const adminAppointmentInputSchema = z.object({
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatný dátum"),
  time: timeString,
  firstName: z.string().min(1, "Meno je povinné"),
  lastName: z.string().optional().default(""),
  phone: z
    .string()
    .min(1, "Telefón je povinný")
    .regex(/^\+4(20|21)\d{9}$/, "Neplatné telefónne číslo"),
  email: z.string().min(1, "Email je povinný").email("Zadajte platný email"),
  notes: z.string().optional().default(""),
  ignoreSchedule: z.boolean().default(false),
});

export type AdminAppointmentInput = z.infer<typeof adminAppointmentInputSchema>;

export const adminAppointmentEditSchema = adminAppointmentInputSchema.extend({
  // Email may be empty for legacy reservations that pre-date the required-email rule.
  email: z.string().email("Neplatný email").optional().or(z.literal("")),
  priceFinal: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
});

export type AdminAppointmentEditInput = z.infer<typeof adminAppointmentEditSchema>;
