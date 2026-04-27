import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const schedules = await prisma.schedule.findMany({
    include: { barber: { select: { firstName: true } } },
    orderBy: { dayOfWeek: "asc" },
  });
  console.log("=== schedules ===");
  for (const s of schedules) {
    console.log(`  dow=${s.dayOfWeek}  ${s.startTime}-${s.endTime}  active=${s.isActive}  barber=${s.barber.firstName}`);
  }

  const overrides = await prisma.scheduleOverride.findMany({
    orderBy: { overrideDate: "asc" },
  });
  console.log(`\n=== schedule_overrides (${overrides.length}) ===`);
  for (const o of overrides) {
    console.log(`  ${o.overrideDate.toISOString().split("T")[0]}  available=${o.isAvailable}  ${o.startTime ?? "-"}-${o.endTime ?? "-"}`);
  }

  const breaks = await prisma.scheduleBreak.findMany({ orderBy: { dayOfWeek: "asc" } });
  console.log(`\n=== schedule_breaks (${breaks.length}) ===`);
  for (const b of breaks) {
    console.log(`  dow=${b.dayOfWeek}  ${b.startTime}-${b.endTime}  label=${b.label}`);
  }

  const appts = await prisma.appointment.findMany({
    where: {
      startTime: { gte: new Date("2026-04-27T00:00:00Z"), lte: new Date("2026-05-03T00:00:00Z") },
    },
    select: { startTime: true, endTime: true, status: true, customerName: true },
    orderBy: { startTime: "asc" },
  });
  console.log(`\n=== appointments next week (${appts.length}) ===`);
  for (const a of appts) {
    console.log(`  ${a.startTime.toISOString()} → ${a.endTime.toISOString()}  ${a.status}  ${a.customerName ?? ""}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
