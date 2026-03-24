import { z } from "zod";

export const bookingInputSchema = z.object({
  serviceId: z.string().uuid(),
  barberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  firstName: z.string().min(1, "Meno je povinné"),
  lastName: z.string().optional().default(""),
  phone: z.string().min(1, "Telefón je povinný").regex(/^(\+421)?9\d{8}$/, "Neplatné telefónne číslo"),
  email: z.string().email("Zadajte platný email"),
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

export const scheduleInputSchema = z.object({
  barberId: z.string().uuid(),
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean().default(true),
});

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export const breakInputSchema = z.object({
  barberId: z.string().uuid(),
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().default("Prestávka"),
});

export type BreakInput = z.infer<typeof breakInputSchema>;

export const customerInputSchema = z.object({
  firstName: z.string().min(1, "Meno je povinné"),
  lastName: z.string().optional().default(""),
  phone: z.string().min(1, "Telefón je povinný").regex(/^(\+421)?9\d{8}$/, "Neplatné SK telefónne číslo"),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional().default(""),
});

export type CustomerInput = z.infer<typeof customerInputSchema>;
