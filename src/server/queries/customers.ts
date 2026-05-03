import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { tsToDate, normalizeSearchInput } from "@/server/lib/firestore-utils";
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
  cursor: string | undefined,
  search?: string
): Promise<{ items: CustomerView[]; nextCursor: string | null }> {
  const trimmed = search ? normalizeSearchInput(search) : "";

  if (trimmed) {
    // Search path: array-contains on prefix tokens. Cap the result so a
    // very common prefix ("a") cannot pull thousands of docs in one go.
    const snap = await adminDb
      .collection("customers")
      .where("searchTokens", "array-contains", trimmed)
      .limit(200)
      .get();
    const items = snap.docs
      .map((d) => mapCustomer(d))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return { items, nextCursor: null };
  }

  // Cursor pagination on updatedAt DESC. Reads only PAGE_SIZE+1 per page.
  let query = adminDb.collection("customers").orderBy("updatedAt", "desc");
  if (cursor) {
    const ms = Number(cursor);
    if (Number.isFinite(ms)) {
      query = query.startAfter(Timestamp.fromMillis(ms));
    }
  }
  const snap = await query.limit(PAGE_SIZE + 1).get();
  const hasMore = snap.size > PAGE_SIZE;
  const docs = hasMore ? snap.docs.slice(0, PAGE_SIZE) : snap.docs;

  const items = docs.map((d) => mapCustomer(d));
  const nextCursor =
    hasMore && items.length > 0
      ? items[items.length - 1].updatedAt.getTime().toString()
      : null;

  return { items, nextCursor };
}

export async function getCustomerById(
  id: string
): Promise<CustomerWithAppointmentsView | null> {
  const snap = await adminDb.doc(`customers/${id}`).get();
  if (!snap.exists) return null;
  const base = mapCustomer(snap);

  // Bounded read — a long-tenured customer's full history was previously
  // pulled in one go, which scales linearly with usage. 100 most-recent
  // appointments is enough for the customer detail page; older entries
  // can be paginated in once the UI grows that far.
  const apptsSnap = await adminDb
    .collection("appointments")
    .where("customerId", "==", id)
    .orderBy("startTime", "desc")
    .limit(100)
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
