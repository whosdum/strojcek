import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { tsToDate } from "@/server/lib/firestore-utils";
import { PAGE_SIZE } from "@/lib/constants";
import type {
  CustomerView,
  CustomerWithAppointmentsView,
  AppointmentStatus,
} from "@/lib/types";
import type { CustomerDoc, AppointmentDoc } from "@/server/types/firestore";

function mapCustomer(doc: FirebaseFirestore.DocumentSnapshot): CustomerView {
  const d = doc.data() as CustomerDoc;
  return {
    id: doc.id,
    firstName: d.firstName,
    lastName: d.lastName ?? null,
    phone: d.phone,
    email: d.email ?? null,
    notes: d.notes ?? null,
    visitCount: d.visitCount,
    createdAt: tsToDate(d.createdAt),
    updatedAt: tsToDate(d.updatedAt),
  };
}

export async function getCustomers(
  page = 1,
  search?: string
): Promise<{ items: CustomerView[]; total: number; pages: number }> {
  const allSnap = search
    ? await adminDb
        .collection("customers")
        .where("searchTokens", "array-contains", search.toLowerCase().trim())
        .get()
    : await adminDb.collection("customers").get();

  const all = allSnap.docs
    .map((d) => mapCustomer(d))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { items, total, pages };
}

export async function getCustomerById(
  id: string
): Promise<CustomerWithAppointmentsView | null> {
  const snap = await adminDb.doc(`customers/${id}`).get();
  if (!snap.exists) return null;
  const base = mapCustomer(snap);

  const apptsSnap = await adminDb
    .collection("appointments")
    .where("customerId", "==", id)
    .orderBy("startTime", "desc")
    .get();

  const appointments = apptsSnap.docs.map((d) => {
    const data = d.data() as AppointmentDoc;
    return {
      id: d.id,
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
      source: data.source,
      reminderSentAt: data.reminderSentAt ? tsToDate(data.reminderSentAt) : null,
      serviceBufferMinutes: data.serviceBufferMinutes,
      createdAt: tsToDate(data.createdAt),
      updatedAt: tsToDate(data.updatedAt),
      barber: {
        firstName: data.barberName.split(" ")[0] ?? "",
        lastName: data.barberName.split(" ").slice(1).join(" ") ?? "",
      },
      service: { name: data.serviceName },
    };
  });

  return { ...base, appointments };
}

export async function getCustomerByPhone(
  phone: string
): Promise<CustomerView | null> {
  const idx = await adminDb.doc(`customerPhones/${phone}`).get();
  if (!idx.exists) return null;
  const customerId = (idx.data() as { customerId: string }).customerId;
  const snap = await adminDb.doc(`customers/${customerId}`).get();
  if (!snap.exists) return null;
  return mapCustomer(snap);
}
