import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { dateKey, tsToDate, tsToDateOrNull } from "@/server/lib/firestore-utils";
import { PAGE_SIZE, TIMEZONE } from "@/lib/constants";
import { startOfDay, startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type {
  AppointmentView,
  AppointmentWithBarberServiceView,
  AppointmentDetailView,
  AppointmentListView,
  AppointmentStatus,
  AppointmentSource,
  AppointmentStatusHistoryView,
} from "@/lib/types";
import type {
  AppointmentDoc,
  AppointmentStatusHistoryDoc,
} from "@/server/types/firestore";
import { getBarberById } from "@/server/queries/barbers";
import { getServiceById } from "@/server/queries/services";

function nowInTz(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  if (!full) return { firstName: "", lastName: "" };
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function mapAppointment(
  doc: FirebaseFirestore.DocumentSnapshot
): AppointmentView {
  const d = doc.data() as AppointmentDoc;
  return {
    id: doc.id,
    barberId: d.barberId,
    customerId: d.customerId ?? null,
    serviceId: d.serviceId,
    startTime: tsToDate(d.startTime),
    endTime: tsToDate(d.endTime),
    status: d.status as AppointmentStatus,
    priceExpected: d.priceExpectedCents / 100,
    priceFinal: d.priceFinalCents != null ? d.priceFinalCents / 100 : null,
    customerName: d.customerName ?? null,
    customerPhone: d.customerPhone ?? null,
    customerEmail: d.customerEmail ?? null,
    cancellationToken: d.cancellationTokenHash ?? null,
    cancellationReason: d.cancellationReason ?? null,
    notes: d.notes ?? null,
    source: d.source as AppointmentSource,
    reminderSentAt: tsToDateOrNull(d.reminderSentAt),
    serviceBufferMinutes: d.serviceBufferMinutes,
    createdAt: tsToDate(d.createdAt),
    updatedAt: tsToDate(d.updatedAt),
  };
}

function withBarberService(
  base: AppointmentView,
  data: AppointmentDoc
): AppointmentWithBarberServiceView {
  const { firstName, lastName } = splitName(data.barberName);
  return {
    ...base,
    barber: { firstName, lastName },
    service: { name: data.serviceName },
  };
}

export async function getTodayAppointments(): Promise<
  AppointmentWithBarberServiceView[]
> {
  const today = startOfDay(nowInTz());
  const todayKey = dateKey(today);

  const snap = await adminDb
    .collection("appointments")
    .where("startDateKey", "==", todayKey)
    .get();

  return snap.docs
    .map((d) => {
      const data = d.data() as AppointmentDoc;
      const base = mapAppointment(d);
      return withBarberService(base, data);
    })
    .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export async function getUpcomingAppointments(
  limit = 5
): Promise<AppointmentWithBarberServiceView[]> {
  const now = Timestamp.fromDate(new Date());
  const snap = await adminDb
    .collection("appointments")
    .where("startTime", ">=", now)
    .orderBy("startTime", "asc")
    .limit(limit * 2) // over-fetch to compensate filter
    .get();

  const all = snap.docs
    .map((d) => {
      const data = d.data() as AppointmentDoc;
      const base = mapAppointment(d);
      return withBarberService(base, data);
    })
    .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW");

  return all.slice(0, limit);
}

export type AppointmentListViewMode = "upcoming" | "past" | "all";

interface GetAppointmentsParams {
  /** Cursor = ISO timestamp of the last item on the previous page. */
  cursor?: string;
  barberId?: string;
  status?: AppointmentStatus;
  /** Default "upcoming" — today onwards, ascending (closest first). */
  view?: AppointmentListViewMode;
}

export async function getAppointments({
  cursor,
  barberId,
  status,
  view = "upcoming",
}: GetAppointmentsParams = {}): Promise<{
  items: AppointmentListView[];
  nextCursor: string | null;
}> {
  // Cursor-based Firestore-native pagination. Push the orderBy/limit
  // into the query so we never read more than PAGE_SIZE+1 docs per page.
  // The previous offset/JS-paginate approach would scale O(total) per
  // request — unbounded read amplification at production volumes.
  let query: FirebaseFirestore.Query = adminDb.collection("appointments");
  if (barberId) query = query.where("barberId", "==", barberId);
  if (status) query = query.where("status", "==", status);

  if (view === "upcoming") {
    const startOfToday = fromZonedTime(startOfDay(nowInTz()), TIMEZONE);
    query = query
      .where("startTime", ">=", Timestamp.fromDate(startOfToday))
      .orderBy("startTime", "asc");
  } else if (view === "past") {
    const startOfToday = fromZonedTime(startOfDay(nowInTz()), TIMEZONE);
    query = query
      .where("startTime", "<", Timestamp.fromDate(startOfToday))
      .orderBy("startTime", "desc");
  } else {
    query = query.orderBy("startTime", "desc");
  }

  if (cursor) {
    const ms = Number(cursor);
    if (Number.isFinite(ms)) {
      query = query.startAfter(Timestamp.fromMillis(ms));
    }
  }

  const snap = await query.limit(PAGE_SIZE + 1).get();
  const hasMore = snap.size > PAGE_SIZE;
  const docs = hasMore ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;

  const items = docs.map((d) => {
    const data = d.data() as AppointmentDoc;
    const base = mapAppointment(d);
    const { firstName, lastName } = splitName(data.barberName);
    const customerSplit = splitName(data.customerName);
    return {
      ...base,
      barber: { firstName, lastName },
      service: { name: data.serviceName },
      customer:
        data.customerName || data.customerPhone
          ? {
              firstName: customerSplit.firstName,
              lastName: customerSplit.lastName || null,
              phone: data.customerPhone ?? "",
            }
          : null,
    } as AppointmentListView;
  });

  const nextCursor =
    hasMore && items.length > 0
      ? items[items.length - 1].startTime.getTime().toString()
      : null;

  return { items, nextCursor };
}

export async function getAppointmentById(
  id: string
): Promise<AppointmentDetailView | null> {
  const ref = adminDb.doc(`appointments/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as AppointmentDoc;
  const base = mapAppointment(snap);

  const [barber, service, historySnap, customerSnap] = await Promise.all([
    getBarberById(data.barberId),
    getServiceById(data.serviceId),
    ref.collection("history").orderBy("changedAt", "desc").get(),
    data.customerId ? adminDb.doc(`customers/${data.customerId}`).get() : null,
  ]);

  if (!barber || !service) return null;

  const statusHistory: AppointmentStatusHistoryView[] = historySnap.docs.map(
    (h) => {
      const hd = h.data() as AppointmentStatusHistoryDoc;
      return {
        id: h.id,
        appointmentId: id,
        oldStatus: (hd.oldStatus as AppointmentStatus | null) ?? null,
        newStatus: hd.newStatus as AppointmentStatus,
        changedBy: hd.changedBy ?? null,
        reason: hd.reason ?? null,
        changedAt: tsToDate(hd.changedAt),
      };
    }
  );

  let customer: AppointmentDetailView["customer"] = null;
  if (customerSnap?.exists) {
    const cd = customerSnap.data() as {
      firstName: string;
      lastName: string | null;
      phone: string;
      email: string | null;
      notes: string | null;
      visitCount: number;
      createdAt: FirebaseFirestore.Timestamp;
      updatedAt: FirebaseFirestore.Timestamp;
    };
    customer = {
      id: customerSnap.id,
      firstName: cd.firstName,
      lastName: cd.lastName ?? null,
      phone: cd.phone,
      email: cd.email ?? null,
      notes: cd.notes ?? null,
      visitCount: cd.visitCount,
      createdAt: tsToDate(cd.createdAt),
      updatedAt: tsToDate(cd.updatedAt),
    };
  }

  return {
    ...base,
    barber,
    service,
    customer,
    statusHistory,
  };
}

export async function getAppointmentsForCalendar(
  startDate: Date,
  endDate: Date,
  barberId?: string
): Promise<AppointmentWithBarberServiceView[]> {
  let query: FirebaseFirestore.Query = adminDb.collection("appointments");
  if (barberId) query = query.where("barberId", "==", barberId);

  const snap = await query
    .where("startTime", ">=", Timestamp.fromDate(startDate))
    .where("startTime", "<=", Timestamp.fromDate(endDate))
    .get();

  return snap.docs
    .map((d) => {
      const data = d.data() as AppointmentDoc;
      const base = mapAppointment(d);
      return withBarberService(base, data);
    })
    .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export async function getDayStats(date: Date = nowInTz()): Promise<{
  total: number;
  completed: number;
  noShow: number;
  noShowRate: number;
}> {
  const dayKey = dateKey(date);
  const snap = await adminDb
    .collection("appointments")
    .where("startDateKey", "==", dayKey)
    .limit(200)
    .get();

  let total = 0;
  let completed = 0;
  let noShow = 0;
  for (const d of snap.docs) {
    const data = d.data() as AppointmentDoc;
    if (data.status === "CANCELLED") continue;
    total++;
    if (data.status === "COMPLETED") completed++;
    if (data.status === "NO_SHOW") noShow++;
  }

  return {
    total,
    completed,
    noShow,
    noShowRate: total > 0 ? noShow / total : 0,
  };
}

export async function getServicePopularity(
  limit = 5
): Promise<Array<{ serviceName: string; count: number; revenue: number }>> {
  const monthStart = startOfMonth(nowInTz());
  const snap = await adminDb
    .collection("appointments")
    .where("startTime", ">=", Timestamp.fromDate(monthStart))
    .limit(2000)
    .get();

  const stats = new Map<string, { name: string; count: number; revenueCents: number }>();
  for (const d of snap.docs) {
    const data = d.data() as AppointmentDoc;
    if (data.status === "CANCELLED" || data.status === "NO_SHOW") continue;
    const existing = stats.get(data.serviceId);
    if (existing) {
      existing.count++;
      existing.revenueCents += data.priceExpectedCents;
    } else {
      stats.set(data.serviceId, {
        name: data.serviceName,
        count: 1,
        revenueCents: data.priceExpectedCents,
      });
    }
  }

  return [...stats.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((s) => ({
      serviceName: s.name,
      count: s.count,
      revenue: s.revenueCents / 100,
    }));
}
