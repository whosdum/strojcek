import "dotenv/config";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_* env vars");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

async function deleteCollection(path: string, batchSize = 200) {
  const ref = db.collection(path);
  const snap = await ref.limit(batchSize).get();
  if (snap.empty) return;
  const batch = db.batch();
  for (const d of snap.docs) batch.delete(d.ref);
  await batch.commit();
  if (snap.size === batchSize) await deleteCollection(path, batchSize);
}

async function deleteSubcollections(parentPath: string, names: string[]) {
  const parent = await db.collection(parentPath).get();
  for (const p of parent.docs) {
    for (const sub of names) {
      await deleteCollection(`${parentPath}/${p.id}/${sub}`);
    }
  }
}

async function wipe() {
  console.log("Wiping existing data...");
  // Subcollections first
  await deleteSubcollections("appointments", ["history"]);
  await deleteSubcollections("barbers", ["services", "schedules", "breaks", "overrides"]);
  // Top-level
  await deleteCollection("appointments");
  await deleteCollection("customers");
  await deleteCollection("customerPhones");
  await deleteCollection("counters");
  await deleteCollection("services");
  await deleteCollection("barbers");
  await db.doc("shopSettings/default").delete().catch(() => {});
}

interface ServiceSeed {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  bufferMinutes: number;
  sortOrder: number;
}

async function seed() {
  console.log("Seeding Firestore...");

  // Shop settings
  await db.doc("shopSettings/default").set({
    slotIntervalMinutes: 60,
    updatedAt: Timestamp.now(),
  });

  // Services
  const services: ServiceSeed[] = [
    {
      id: randomUUID(),
      name: "Pánsky strih",
      description:
        "Kompletný pánsky strih zahŕňa osobnú konzultáciu, strih podľa vášho štýlu, umytie vlasov a finálny styling. Profesionálna starostlivosť a fresh cut.",
      durationMinutes: 60,
      priceCents: 1800,
      bufferMinutes: 5,
      sortOrder: 0,
    },
    {
      id: randomUUID(),
      name: "Pánsky strih a úprava brady",
      description:
        "Komplexná starostlivosť o vlasy aj bradu. Zahŕňa konzultáciu, presný strih, umytie vlasov, úpravu brady alebo kontúr a profesionálny styling. Perfektne upravený vzhľad v jednej službe.",
      durationMinutes: 90,
      priceCents: 2300,
      bufferMinutes: 5,
      sortOrder: 1,
    },
    {
      id: randomUUID(),
      name: "Strojček Rituál – kompletný strih, brada, vosk a hot towel",
      description:
        "Zažite kompletnú starostlivosť o vlasy a bradu – od presného strihu a umytia vlasov, cez úpravu brady alebo kontúr, až po profesionálny styling. Súčasťou je aj depilácia voskom, relaxačný zábal horúcim uterákom a tradičné turecké opaľovanie uší. Všetko v jednej službe pre perfektne upravený vzhľad a pocit absolútnej starostlivosti.",
      durationMinutes: 90,
      priceCents: 3000,
      bufferMinutes: 5,
      sortOrder: 2,
    },
    {
      id: randomUUID(),
      name: "Úprava brady",
      description:
        "Úprava brady na mieru – od jemného zastrihnutia až po presné, ostré línie. Zameriavame sa na detail, symetriu a čistý finish. Svieži, moderný vzhľad, ktorý zvýrazní tvoj štýl.",
      durationMinutes: 30,
      priceCents: 1500,
      bufferMinutes: 5,
      sortOrder: 3,
    },
    {
      id: randomUUID(),
      name: "Študentský strih",
      description:
        "Zvýhodnený študentský strih obsahuje strih na mieru a finálnu úpravu. Profesionálny prístup, fresh look a príjemná atmosféra. Zľava platí po predložení študentského preukazu.",
      durationMinutes: 60,
      priceCents: 1500,
      bufferMinutes: 5,
      sortOrder: 4,
    },
  ];

  const serviceBatch = db.batch();
  for (const s of services) {
    serviceBatch.set(db.doc(`services/${s.id}`), {
      id: s.id,
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
      bufferMinutes: s.bufferMinutes,
      isActive: true,
      sortOrder: s.sortOrder,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
  await serviceBatch.commit();

  // Barber: Martin
  const martinId = randomUUID();
  await db.doc(`barbers/${martinId}`).set({
    id: martinId,
    firstName: "Martin",
    lastName: "Mikolášik",
    email: "strojcekbarbershop@gmail.com",
    phone: "+421944932871",
    bio: "Váš barber v Strojčeku.",
    avatarUrl: "/barbers/martin.png",
    isActive: true,
    sortOrder: 0,
    serviceIds: services.map((s) => s.id),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // BarberService subcollection (with denormalized service details)
  const bsBatch = db.batch();
  for (const s of services) {
    bsBatch.set(db.doc(`barbers/${martinId}/services/${s.id}`), {
      serviceId: s.id,
      customPriceCents: null,
      customDuration: null,
      serviceName: s.name,
      defaultDuration: s.durationMinutes,
      bufferMinutes: s.bufferMinutes,
      defaultPriceCents: s.priceCents,
    });
  }
  await bsBatch.commit();

  // Schedules: Mon–Fri 09:00–17:00, Sat 09:00–13:00
  const schedBatch = db.batch();
  for (let day = 1; day <= 5; day++) {
    schedBatch.set(db.doc(`barbers/${martinId}/schedules/${day}`), {
      dayOfWeek: day,
      startTime: "09:00",
      endTime: "17:00",
      isActive: true,
    });
  }
  schedBatch.set(db.doc(`barbers/${martinId}/schedules/6`), {
    dayOfWeek: 6,
    startTime: "09:00",
    endTime: "13:00",
    isActive: true,
  });
  await schedBatch.commit();

  // Lunch breaks: Mon–Fri 12:00–12:30
  const breakBatch = db.batch();
  for (let day = 1; day <= 5; day++) {
    const id = randomUUID();
    breakBatch.set(db.doc(`barbers/${martinId}/breaks/${id}`), {
      id,
      dayOfWeek: day,
      startTime: "12:00",
      endTime: "12:30",
      label: "Obed",
    });
  }
  await breakBatch.commit();

  console.log("Seed completed:");
  console.log(`  - 1 barber (Martin) — ${martinId}`);
  console.log(`  - ${services.length} services`);
  console.log(`  - 6 schedules (Mon–Sat)`);
  console.log(`  - 5 lunch breaks`);
  console.log(`  - shopSettings/default (interval 60min)`);
}

async function main() {
  await wipe();
  await seed();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
