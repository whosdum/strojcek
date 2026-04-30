import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { tsToDate, tsToDateOrNull } from "@/server/lib/firestore-utils";
import { getTokenLookupValues } from "@/server/lib/tokens";
import type {
  AppointmentTokenView,
  AppointmentStatus,
  AppointmentSource,
} from "@/lib/types";
import type { AppointmentDoc } from "@/server/types/firestore";

async function findByTokenField(
  field: "cancellationTokenHash" | "cancellationTokenFallback",
  value: string
): Promise<AppointmentTokenView | null> {
  const snap = await adminDb
    .collection("appointments")
    .where(field, "==", value)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data() as AppointmentDoc;

  const serviceSnap = await adminDb.doc(`services/${data.serviceId}`).get();
  const serviceData = serviceSnap.exists
    ? (serviceSnap.data() as {
        name: string;
        durationMinutes: number;
        priceCents: number;
      })
    : null;

  const [firstName, ...lastParts] = (data.barberName ?? "").trim().split(/\s+/);

  return {
    id: doc.id,
    barberId: data.barberId,
    customerId: data.customerId ?? null,
    serviceId: data.serviceId,
    startTime: tsToDate(data.startTime),
    endTime: tsToDate(data.endTime),
    status: data.status as AppointmentStatus,
    priceExpected: data.priceExpectedCents / 100,
    priceFinal: data.priceFinalCents != null ? data.priceFinalCents / 100 : null,
    customerName: data.customerName ?? null,
    customerPhone: data.customerPhone ?? null,
    customerEmail: data.customerEmail ?? null,
    cancellationToken: data.cancellationTokenHash ?? null,
    cancellationReason: data.cancellationReason ?? null,
    notes: data.notes ?? null,
    source: data.source as AppointmentSource,
    reminderSentAt: tsToDateOrNull(data.reminderSentAt),
    serviceBufferMinutes: data.serviceBufferMinutes,
    createdAt: tsToDate(data.createdAt),
    updatedAt: tsToDate(data.updatedAt),
    barber: {
      firstName: firstName ?? "",
      lastName: lastParts.join(" "),
    },
    service: {
      name: serviceData?.name ?? data.serviceName,
      durationMinutes:
        serviceData?.durationMinutes ?? Math.round(
          (tsToDate(data.endTime).getTime() - tsToDate(data.startTime).getTime()) /
            60000
        ),
      price: serviceData ? serviceData.priceCents / 100 : data.priceExpectedCents / 100,
    },
  };
}

export async function getAppointmentByToken(
  rawToken: string
): Promise<AppointmentTokenView | null> {
  const [primary, fallback] = getTokenLookupValues(rawToken);

  const primaryHit = await findByTokenField("cancellationTokenHash", primary);
  if (primaryHit) return primaryHit;

  if (fallback) {
    const fallbackHit = await findByTokenField(
      "cancellationTokenFallback",
      fallback
    );
    if (fallbackHit) return fallbackHit;
  }

  return null;
}
