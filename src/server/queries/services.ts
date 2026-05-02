import "server-only";
import { adminDb } from "@/server/lib/firebase-admin";
import { tsToDate } from "@/server/lib/firestore-utils";
import type { ServiceView } from "@/lib/types";
import type { ServiceDoc } from "@/server/types/firestore";

function mapService(doc: FirebaseFirestore.QueryDocumentSnapshot): ServiceView {
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

export async function getActiveServices(): Promise<ServiceView[]> {
  const snap = await adminDb
    .collection("services")
    .where("isActive", "==", true)
    .orderBy("sortOrder", "asc")
    .limit(50)
    .get();
  return snap.docs.map(mapService);
}

export async function getAllServices(): Promise<ServiceView[]> {
  const snap = await adminDb
    .collection("services")
    .orderBy("sortOrder", "asc")
    .limit(100)
    .get();
  return snap.docs.map(mapService);
}

export async function getServiceById(id: string): Promise<ServiceView | null> {
  const snap = await adminDb.doc(`services/${id}`).get();
  if (!snap.exists) return null;
  return mapService(snap as FirebaseFirestore.QueryDocumentSnapshot);
}
