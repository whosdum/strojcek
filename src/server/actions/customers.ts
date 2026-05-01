"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/server/lib/firebase-admin";
import { generateSearchTokens } from "@/server/lib/firestore-utils";
import { getSession } from "@/server/lib/auth";
import { customerInputSchema } from "@/lib/validators";
import { normalizePhone } from "@/server/lib/phone";

type ActionResult = { success: boolean; error?: string };

const UNAUTH: ActionResult = {
  success: false,
  error: "Neautorizovaný prístup.",
};

export async function updateCustomer(
  id: string,
  input: unknown
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const data = customerInputSchema.parse(input);
    const newPhone = normalizePhone(data.phone);

    await adminDb.runTransaction(async (tx) => {
      const customerRef = adminDb.doc(`customers/${id}`);
      const snap = await tx.get(customerRef);
      if (!snap.exists) throw new Error("CUSTOMER_NOT_FOUND");

      const existing = snap.data() as { phone: string };
      const oldPhone = existing.phone;

      if (oldPhone !== newPhone) {
        const newPhoneIdxRef = adminDb.doc(`customerPhones/${newPhone}`);
        const conflict = await tx.get(newPhoneIdxRef);
        if (conflict.exists && conflict.data()?.customerId !== id) {
          throw new Error("PHONE_TAKEN");
        }
        tx.delete(adminDb.doc(`customerPhones/${oldPhone}`));
        tx.set(newPhoneIdxRef, { customerId: id });
      }

      const searchTokens = generateSearchTokens([
        data.firstName,
        data.lastName,
        newPhone,
        data.email ?? null,
      ]);

      tx.update(customerRef, {
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        phone: newPhone,
        phoneSearch: newPhone.slice(-9),
        email: data.email || null,
        emailSearch: data.email ? data.email.toLowerCase() : null,
        notes: data.notes || null,
        searchTokens,
        updatedAt: Timestamp.now(),
      });
    });

    revalidatePath(`/admin/customers/${id}`);
    revalidatePath("/admin/customers");
    return { success: true };
  } catch (e) {
    console.error("[updateCustomer]", e);
    if (e instanceof Error && e.message === "PHONE_TAKEN") {
      return {
        success: false,
        error: "Toto telefónne číslo už používa iný zákazník.",
      };
    }
    return { success: false, error: "Nastala chyba pri aktualizácii zákazníka." };
  }
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTH;
  try {
    const customerRef = adminDb.doc(`customers/${id}`);
    const snap = await customerRef.get();
    if (!snap.exists) {
      return { success: false, error: "Zákazník nenájdený." };
    }
    const phone = (snap.data() as { phone: string }).phone;

    // Soft-detach appointments (batch up to 500)
    const apptsSnap = await adminDb
      .collection("appointments")
      .where("customerId", "==", id)
      .get();

    if (!apptsSnap.empty) {
      const batches: FirebaseFirestore.WriteBatch[] = [];
      let current = adminDb.batch();
      let count = 0;
      for (const d of apptsSnap.docs) {
        current.update(d.ref, { customerId: null });
        count++;
        if (count >= 450) {
          batches.push(current);
          current = adminDb.batch();
          count = 0;
        }
      }
      if (count > 0) batches.push(current);
      for (const b of batches) await b.commit();
    }

    const finalBatch = adminDb.batch();
    finalBatch.delete(customerRef);
    finalBatch.delete(adminDb.doc(`customerPhones/${phone}`));
    await finalBatch.commit();

    revalidatePath("/admin/customers");
    return { success: true };
  } catch (e) {
    console.error("[deleteCustomer]", e);
    return { success: false, error: "Nastala chyba pri mazaní zákazníka." };
  }
}
