import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { tsToDate } from "@/server/lib/firestore-utils";
import type {
  ActiveBarberWithServiceIdsView,
  BarberView,
  BarberWithServicesView,
  BarberWithSchedulesView,
  BarberFullView,
  BarberServiceView,
  ServiceView,
  ScheduleView,
  ScheduleBreakView,
} from "@/lib/types";
import type {
  BarberDoc,
  BarberServiceDoc,
  ServiceDoc,
  ScheduleDoc,
  ScheduleBreakDoc,
} from "@/server/types/firestore";

function mapBarberBase(
  doc: FirebaseFirestore.DocumentSnapshot
): BarberView {
  const d = doc.data() as BarberDoc;
  return {
    id: doc.id,
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email ?? null,
    phone: d.phone ?? null,
    bio: d.bio ?? null,
    avatarUrl: d.avatarUrl ?? null,
    isActive: d.isActive,
    sortOrder: d.sortOrder,
    createdAt: tsToDate(d.createdAt),
    updatedAt: tsToDate(d.updatedAt),
  };
}

function mapServiceDoc(doc: FirebaseFirestore.DocumentSnapshot): ServiceView {
  const d = doc.data() as ServiceDoc;
  return {
    id: doc.id,
    name: d.name,
    description: d.description ?? null,
    durationMinutes: d.durationMinutes,
    price: d.priceCents / 100,
    bufferMinutes: d.bufferMinutes,
    isActive: d.isActive,
    sortOrder: d.sortOrder,
    createdAt: tsToDate(d.createdAt),
    updatedAt: tsToDate(d.updatedAt),
  };
}

function mapScheduleDoc(
  barberId: string,
  doc: FirebaseFirestore.QueryDocumentSnapshot
): ScheduleView {
  const d = doc.data() as ScheduleDoc;
  return {
    id: doc.id,
    barberId,
    dayOfWeek: d.dayOfWeek,
    startTime: d.startTime,
    endTime: d.endTime,
    isActive: d.isActive,
  };
}

function mapBreakDoc(
  barberId: string,
  doc: FirebaseFirestore.QueryDocumentSnapshot
): ScheduleBreakView {
  const d = doc.data() as ScheduleBreakDoc;
  return {
    id: doc.id,
    barberId,
    dayOfWeek: d.dayOfWeek,
    startTime: d.startTime,
    endTime: d.endTime,
    label: d.label,
  };
}

async function loadBarberServices(
  barberId: string
): Promise<Array<BarberServiceView & { service: ServiceView }>> {
  const subSnap = await adminDb
    .collection(`barbers/${barberId}/services`)
    .get();
  if (subSnap.empty) return [];

  const serviceIds = subSnap.docs.map((d) => d.id);
  const serviceRefs = serviceIds.map((id) => adminDb.doc(`services/${id}`));
  const serviceSnaps = await adminDb.getAll(...serviceRefs);
  const serviceMap = new Map<string, ServiceView>();
  for (const s of serviceSnaps) {
    if (s.exists) serviceMap.set(s.id, mapServiceDoc(s));
  }

  return subSnap.docs.flatMap((d) => {
    const data = d.data() as BarberServiceDoc;
    const service = serviceMap.get(d.id);
    if (!service) return [];
    const customPrice =
      data.customPriceCents != null ? data.customPriceCents / 100 : null;
    return [
      {
        serviceId: d.id,
        customPrice,
        customDuration: data.customDuration ?? null,
        service,
      },
    ];
  });
}

async function loadSchedulesAndBreaks(barberId: string): Promise<{
  schedules: ScheduleView[];
  scheduleBreaks: ScheduleBreakView[];
}> {
  const [schedSnap, breakSnap] = await Promise.all([
    adminDb.collection(`barbers/${barberId}/schedules`).get(),
    adminDb.collection(`barbers/${barberId}/breaks`).get(),
  ]);
  const schedules = schedSnap.docs
    .map((d) => mapScheduleDoc(barberId, d))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const scheduleBreaks = breakSnap.docs
    .map((d) => mapBreakDoc(barberId, d))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return { schedules, scheduleBreaks };
}

export async function getAllBarbers(): Promise<BarberWithServicesView[]> {
  const snap = await adminDb
    .collection("barbers")
    .orderBy("sortOrder", "asc")
    .get();
  return Promise.all(
    snap.docs.map(async (b) => ({
      ...mapBarberBase(b),
      services: await loadBarberServices(b.id),
    }))
  );
}

export async function getAllBarbersWithSchedules(): Promise<
  BarberWithSchedulesView[]
> {
  const snap = await adminDb
    .collection("barbers")
    .orderBy("sortOrder", "asc")
    .get();
  return Promise.all(
    snap.docs.map(async (b) => {
      const base = mapBarberBase(b);
      const { schedules, scheduleBreaks } = await loadSchedulesAndBreaks(b.id);
      return { ...base, schedules, scheduleBreaks };
    })
  );
}

export async function getActiveBarbersWithServices(): Promise<
  ActiveBarberWithServiceIdsView[]
> {
  const snap = await adminDb
    .collection("barbers")
    .where("isActive", "==", true)
    .orderBy("sortOrder", "asc")
    .get();

  return Promise.all(
    snap.docs.map(async (b) => {
      const base = mapBarberBase(b);
      const subSnap = await adminDb.collection(`barbers/${b.id}/services`).get();
      const serviceIds: string[] = [];
      const overrides: Record<string, { price?: string; duration?: number }> = {};
      for (const s of subSnap.docs) {
        const data = s.data() as BarberServiceDoc;
        serviceIds.push(s.id);
        if (data.customPriceCents != null || data.customDuration != null) {
          overrides[s.id] = {
            ...(data.customPriceCents != null && {
              price: (data.customPriceCents / 100).toString(),
            }),
            ...(data.customDuration != null && { duration: data.customDuration }),
          };
        }
      }
      return {
        id: base.id,
        firstName: base.firstName,
        lastName: base.lastName,
        bio: base.bio,
        avatarUrl: base.avatarUrl,
        serviceIds,
        serviceOverrides: overrides,
      };
    })
  );
}

export async function getBarberById(id: string): Promise<BarberFullView | null> {
  const ref = adminDb.doc(`barbers/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const base = mapBarberBase(snap);
  const [services, sched] = await Promise.all([
    loadBarberServices(id),
    loadSchedulesAndBreaks(id),
  ]);

  return { ...base, services, ...sched };
}
