import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { subMonths } from "date-fns";

/**
 * Periodic cleanup cron — removes stale data:
 * 1. AppointmentStatusHistory older than 12 months
 * 2. Expired Better Auth sessions
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = subMonths(new Date(), 12);

  // 1. Delete old status history (keep last 12 months)
  const historyResult = await prisma.appointmentStatusHistory.deleteMany({
    where: { changedAt: { lt: cutoff } },
  });

  // 2. Delete expired sessions
  const sessionResult = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return NextResponse.json({
    ok: true,
    deletedHistory: historyResult.count,
    deletedSessions: sessionResult.count,
  });
}
