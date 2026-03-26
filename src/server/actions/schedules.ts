"use server";

import { updateTag } from "next/cache";
import { prisma } from "@/server/lib/prisma";
import {
  scheduleInputSchema,
  breakInputSchema,
} from "@/lib/validators";

type ActionResult = { success: boolean; error?: string };

export async function upsertSchedule(input: unknown): Promise<ActionResult> {
  try {
    const data = scheduleInputSchema.parse(input);

    const existing = await prisma.schedule.findFirst({
      where: { barberId: data.barberId, dayOfWeek: data.dayOfWeek },
    });

    if (existing) {
      await prisma.schedule.update({
        where: { id: existing.id },
        data: {
          startTime: data.startTime,
          endTime: data.endTime,
          isActive: data.isActive,
        },
      });
    } else {
      await prisma.schedule.create({ data });
    }

    updateTag("schedules");
    return { success: true };
  } catch (e) {
    console.error("[upsertSchedule]", e);
    return { success: false, error: "Nastala chyba pri ukladaní rozvrhu." };
  }
}

export async function deleteSchedule(id: string): Promise<ActionResult> {
  try {
    await prisma.schedule.delete({ where: { id } });
    updateTag("schedules");
    return { success: true };
  } catch (e) {
    console.error("[deleteSchedule]", e);
    return { success: false, error: "Nastala chyba." };
  }
}

export async function createBreak(input: unknown): Promise<ActionResult> {
  try {
    const data = breakInputSchema.parse(input);
    await prisma.scheduleBreak.create({ data });
    updateTag("schedules");
    return { success: true };
  } catch (e) {
    console.error("[createBreak]", e);
    return { success: false, error: "Nastala chyba pri vytváraní prestávky." };
  }
}

export async function deleteBreak(id: string): Promise<ActionResult> {
  try {
    await prisma.scheduleBreak.delete({ where: { id } });
    updateTag("schedules");
    return { success: true };
  } catch (e) {
    console.error("[deleteBreak]", e);
    return { success: false, error: "Nastala chyba." };
  }
}
