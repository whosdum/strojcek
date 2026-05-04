/**
 * Imports walk-in / blocked-time appointments from `walkins.xlsx` at repo root.
 *
 * The xlsx contents are inlined below (26 rows parsed once via Python). Each
 * row becomes an appointment with:
 *   - source = "walk-in", customerId/Phone/Email = null
 *   - customerName = "Walk-in"
 *   - notes = "Meno: …\nTel: …\nEmail: …" (+ original Poznámka if present)
 *   - duration = exact minutes between Excel "Začiatok" and "Koniec"
 *   - serviceBufferMinutes = 0, priceExpectedCents = 0
 *
 * Uses the same bootstrap as seed-firestore.ts — pass --project=… or set
 * FIREBASE_TARGET. Default target is strojcek-staging.
 *
 * Run:
 *   npx tsx scripts/import-walkins-from-xlsx.ts --project=strojcek-staging
 *   npx tsx scripts/import-walkins-from-xlsx.ts --project=strojcek-production
 *   # add --dry-run to print parsed rows without writing
 */

import { bootstrapAdminApp } from "./_firebase-bootstrap";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { fromZonedTime } from "date-fns-tz";

const TIMEZONE = "Europe/Bratislava";

const { projectId } = bootstrapAdminApp();
const db = getFirestore();

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");

interface Row {
  start: string; // "11.5.2026 15:00"
  end: string;
  name: string;
  phone: string;
  email: string;
  serviceLabel: string;
  origNote: string;
}

// Parsed once from walkins.xlsx (26 rows). Source of truth: the xlsx file in
// repo root. Re-running this script is idempotent on the row level only if
// you delete the previously-imported docs first — IDs are randomly generated
// per run.
const ROWS: Row[] = [
  { start: "11.5.2026 15:00", end: "11.5.2026 16:00", name: "Lucia Belúchová", phone: "+421904901455", email: "micietova.lucia@gmail.com", serviceLabel: "Študentský strih", origNote: "" },
  { start: "6.5.2026 13:00",  end: "6.5.2026 14:00",  name: "Tomáš Fundárek",   phone: "+421944340880", email: "tomaskofundarek@gmail.com", serviceLabel: "Študentský strih", origNote: "" },
  { start: "12.5.2026 10:00", end: "12.5.2026 11:30", name: "Lukaš Hives",      phone: "+421903851184", email: "hivesova.m@azet.sk",        serviceLabel: "Pánsky strih a úprava brady", origNote: "" },
  { start: "5.5.2026 13:00",  end: "5.5.2026 14:00",  name: "Tomas Dutka",      phone: "+421903500396", email: "tomasdut@gmail.com",         serviceLabel: "Pánsky strih", origNote: "" },
  { start: "5.5.2026 12:00",  end: "5.5.2026 13:00",  name: "Patrik Bohus",     phone: "+421907269451", email: "pato.bohus298@gmail.com",    serviceLabel: "Pánsky strih", origNote: "" },
  { start: "12.5.2026 16:00", end: "12.5.2026 17:00", name: "Martin Ďurec",     phone: "+421904040433", email: "martin.durec1@gmail.com",    serviceLabel: "Pánsky strih", origNote: "" },
  { start: "18.5.2026 16:00", end: "18.5.2026 17:00", name: "Matej Rančák",     phone: "+421905486280", email: "j.rancak@gmail.com",         serviceLabel: "Študentský strih", origNote: "" },
  { start: "5.5.2026 15:00",  end: "5.5.2026 16:00",  name: "Filip Mohylák",    phone: "+421903805405", email: "flpmhlk@gmail.com",          serviceLabel: "Študentský strih", origNote: "" },
  { start: "7.5.2026 15:00",  end: "7.5.2026 16:00",  name: "Maroš Hýll",       phone: "+421948599061", email: "majo.h77@gmail.com",         serviceLabel: "Pánsky strih", origNote: "" },
  { start: "5.5.2026 11:00",  end: "5.5.2026 12:00",  name: "Ján Katrušík",     phone: "+421905206642", email: "katrusik@linteo.sk",         serviceLabel: "Pánsky strih", origNote: "" },
  { start: "5.5.2026 9:00",   end: "5.5.2026 10:30",  name: "Patrik Varga",     phone: "+421918210237", email: "Kubaja33@azet.sk",           serviceLabel: "Pánsky strih a úprava brady", origNote: "" },
  { start: "7.5.2026 9:00",   end: "7.5.2026 10:30",  name: "Filip Šútor",      phone: "+421948299925", email: "sutor.filip@gmail.com",      serviceLabel: "Pánsky strih a úprava brady", origNote: "" },
  { start: "21.5.2026 13:00", end: "21.5.2026 14:00", name: "Miroslav  Salášek",phone: "+421908906394", email: "mariocka@post.sk",           serviceLabel: "Študentský strih", origNote: "11 ročný chlapec" },
  { start: "18.5.2026 8:00",  end: "18.5.2026 9:00",  name: "Stefano Pistillo", phone: "+421918910690", email: "stefanopistillo204@gmail.com", serviceLabel: "Pánsky strih", origNote: "" },
  { start: "7.5.2026 7:00",   end: "7.5.2026 8:00",   name: "Tomas Bucek",      phone: "+421949284886", email: "tomasbucek127@gmail.com",    serviceLabel: "Pánsky strih", origNote: "" },
  { start: "14.5.2026 15:00", end: "14.5.2026 16:00", name: "Slavomír  Barčák", phone: "+421911200742", email: "slaviq@me.com",              serviceLabel: "Pánsky strih", origNote: "" },
  { start: "6.5.2026 15:00",  end: "6.5.2026 16:00",  name: "Marek Gajdošík",   phone: "+421910115564", email: "marekgame65@gmail.com",      serviceLabel: "Študentský strih", origNote: "" },
  { start: "6.5.2026 14:00",  end: "6.5.2026 15:00",  name: "Richard Mohylák",  phone: "+421918105382", email: "gumanixsk@gmail.com",        serviceLabel: "Študentský strih", origNote: "" },
  { start: "6.5.2026 10:00",  end: "6.5.2026 11:00",  name: "Martin  Gálik",    phone: "+421949687087", email: "mgalik696@gmail.com",        serviceLabel: "Pánsky strih", origNote: "" },
  { start: "5.5.2026 16:00",  end: "5.5.2026 17:00",  name: "Dávid Jánošik",    phone: "+421948603650", email: "David.janosik5@gmail.com",   serviceLabel: "Pánsky strih", origNote: "" },
  { start: "14.5.2026 16:00", end: "14.5.2026 17:00", name: "Ján Sopóci",       phone: "+421911275146", email: "jansopoci77@gmail.com",      serviceLabel: "Pánsky strih", origNote: "" },
  { start: "15.5.2026 14:00", end: "15.5.2026 15:00", name: "Tomáš Blaško",     phone: "+421918182083", email: "tomasblsk@gmail.com",        serviceLabel: "Pánsky strih", origNote: "" },
  { start: "15.5.2026 15:00", end: "15.5.2026 16:00", name: "Tomáš Blaško",     phone: "+421918182083", email: "tomasblsk@gmail.com",        serviceLabel: "Študentský strih", origNote: "" },
  { start: "7.5.2026 16:00",  end: "7.5.2026 17:00",  name: "Kristian Labuda",  phone: "+421910545301", email: "labudakristian9@gmail.com",  serviceLabel: "Pánsky strih", origNote: "" },
  { start: "7.5.2026 14:00",  end: "7.5.2026 15:00",  name: "Matej Litvík",     phone: "+421910984874", email: "litvikmatos@gmail.com",      serviceLabel: "Pánsky strih", origNote: "" },
  { start: "5.5.2026 17:00",  end: "5.5.2026 18:30",  name: "Lukáš Malík",      phone: "+421902797150", email: "lukasmalik6@gmail.com",      serviceLabel: "Pánsky strih a úprava brady", origNote: "" },
];

/** "11.5.2026 15:00" → { date: "2026-05-11", time: "15:00" } */
function parseSlovakDate(s: string): { date: string; time: string } {
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Bad date: ${s}`);
  const [, d, mo, y, h, mi] = m;
  return {
    date: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`,
    time: `${h.padStart(2, "0")}:${mi}`,
  };
}

async function loadBarberAndService(): Promise<{
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
}> {
  const barbersSnap = await db.collection("barbers").get();
  if (barbersSnap.empty) throw new Error("No barbers in Firestore.");

  const martin =
    barbersSnap.docs.find((d) => {
      const f = (d.data().firstName ?? "").toString().toLowerCase();
      return f === "martin";
    }) ?? barbersSnap.docs[0];

  const barberData = martin.data();
  const barberId = martin.id;
  const barberName = `${barberData.firstName} ${barberData.lastName}`.trim();

  // Pick first service the barber offers — required for AppointmentDoc
  // schema. Walk-ins zero buffer & price downstream so the choice doesn't
  // affect blocking behaviour.
  const bsSnap = await db.collection(`barbers/${barberId}/services`).limit(1).get();
  if (bsSnap.empty) {
    throw new Error(`Barber ${barberId} has no services.`);
  }
  const bs = bsSnap.docs[0].data();
  return {
    barberId,
    barberName,
    serviceId: bs.serviceId,
    serviceName: bs.serviceName,
  };
}

async function main() {
  console.log(`Importing ${ROWS.length} walk-ins to project=${projectId}${DRY_RUN ? " (dry-run)" : ""}`);

  const { barberId, barberName, serviceId, serviceName } =
    await loadBarberAndService();
  console.log(
    `Barber: ${barberName} (${barberId}), serviceId=${serviceId} (${serviceName})`
  );

  const now = Timestamp.now();
  let written = 0;
  let skipped = 0;

  for (const r of ROWS) {
    const start = parseSlovakDate(r.start);
    const end = parseSlovakDate(r.end);
    const startUtc = fromZonedTime(`${start.date}T${start.time}:00`, TIMEZONE);
    const endUtc = fromZonedTime(`${end.date}T${end.time}:00`, TIMEZONE);
    const durationMinutes = Math.round(
      (endUtc.getTime() - startUtc.getTime()) / 60000
    );
    if (durationMinutes <= 0) {
      console.warn(`  ! Skipping ${r.name} ${r.start} — non-positive duration`);
      skipped++;
      continue;
    }

    const noteParts = [
      `Meno: ${r.name}`,
      `Tel: ${r.phone}`,
      r.email ? `Email: ${r.email}` : null,
      r.serviceLabel ? `Služba: ${r.serviceLabel}` : null,
      r.origNote ? `Pôv. poznámka: ${r.origNote}` : null,
    ].filter(Boolean);
    const notes = noteParts.join("\n");

    const apptId = randomUUID();
    const startDateKey = start.date;

    const doc = {
      id: apptId,
      barberId,
      customerId: null,
      serviceId,
      barberName,
      serviceName,
      serviceBufferMinutes: 0,
      customerName: "Walk-in",
      customerPhone: null,
      customerEmail: null,
      startTime: Timestamp.fromDate(startUtc),
      endTime: Timestamp.fromDate(endUtc),
      startDateKey,
      status: "CONFIRMED" as const,
      priceExpectedCents: 0,
      priceFinalCents: null,
      cancellationTokenHash: null,
      cancellationTokenFallback: null,
      cancellationReason: null,
      notes,
      source: "walk-in" as const,
      reminderSentAt: null,
      confirmationEmailSentAt: null,
      confirmationEmailError: null,
      confirmationEmailAttempts: 0,
      cancellationEmailSentAt: null,
      cancellationEmailError: null,
      cancellationEmailAttempts: 0,
      telegramAlertSentAt: null,
      telegramAlertError: null,
      createdAt: now,
      updatedAt: now,
    };

    if (DRY_RUN) {
      console.log(
        `  [dry] ${start.date} ${start.time}-${end.time} (${durationMinutes}min) | ${r.name}`
      );
      written++;
      continue;
    }

    await db.runTransaction(async (tx) => {
      const apptRef = db.doc(`appointments/${apptId}`);
      tx.create(apptRef, doc);
      const histRef = apptRef.collection("history").doc();
      tx.create(histRef, {
        id: histRef.id,
        oldStatus: null,
        newStatus: "CONFIRMED",
        changedBy: "import-walkins",
        reason: "Imported from walkins.xlsx",
        changedAt: now,
        expireAt: Timestamp.fromMillis(
          now.toMillis() + 365 * 24 * 60 * 60 * 1000
        ),
      });
    });
    written++;
    console.log(
      `  ✓ ${start.date} ${start.time}-${end.time} (${durationMinutes}min) | ${r.name}`
    );
  }

  console.log(
    `\nDone. ${DRY_RUN ? "[dry-run] " : ""}written=${written}, skipped=${skipped}`
  );
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
