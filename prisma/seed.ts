import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.appointmentStatusHistory.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.scheduleBreak.deleteMany();
  await prisma.scheduleOverride.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.barberService.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.service.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.shopSettings.deleteMany();

  // Create barber
  const martin = await prisma.barber.create({
    data: {
      firstName: "Martin",
      lastName: "Mikolášik",
      email: "strojcekbarbershop@gmail.com",
      phone: "+421944932871",
      bio: "Váš barber v Strojčeku.",
      avatarUrl: "/barbers/martin.png",
      isActive: true,
      sortOrder: 0,
    },
  });

  const barbers = [martin];

  // Create services
  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: "Pánsky strih",
        description:
          "Kompletný pánsky strih zahŕňa osobnú konzultáciu, strih podľa vášho štýlu, umytie vlasov a finálny styling. Profesionálna starostlivosť a fresh cut.",
        durationMinutes: 60,
        price: 18,
        bufferMinutes: 5,
        sortOrder: 0,
      },
    }),
    prisma.service.create({
      data: {
        name: "Pánsky strih a úprava brady",
        description:
          "Komplexná starostlivosť o vlasy aj bradu. Zahŕňa konzultáciu, presný strih, umytie vlasov, úpravu brady alebo kontúr a profesionálny styling. Perfektne upravený vzhľad v jednej službe.",
        durationMinutes: 90,
        price: 23,
        bufferMinutes: 5,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        name: "Strojček Rituál – kompletný strih, brada, vosk a hot towel",
        description:
          "Zažite kompletnú starostlivosť o vlasy a bradu – od presného strihu a umytia vlasov, cez úpravu brady alebo kontúr, až po profesionálny styling. Súčasťou je aj depilácia voskom, relaxačný zábal horúcim uterákom a tradičné turecké opaľovanie uší. Všetko v jednej službe pre perfektne upravený vzhľad a pocit absolútnej starostlivosti.",
        durationMinutes: 90,
        price: 30,
        bufferMinutes: 5,
        sortOrder: 2,
      },
    }),
    prisma.service.create({
      data: {
        name: "Úprava brady",
        description:
          "Úprava brady na mieru – od jemného zastrihnutia až po presné, ostré línie. Zameriavame sa na detail, symetriu a čistý finish. Svieži, moderný vzhľad, ktorý zvýrazní tvoj štýl.",
        durationMinutes: 30,
        price: 15,
        bufferMinutes: 5,
        sortOrder: 3,
      },
    }),
    prisma.service.create({
      data: {
        name: "Študentský strih",
        description:
          "Zvýhodnený študentský strih obsahuje strih na mieru a finálnu úpravu. Profesionálny prístup, fresh look a príjemná atmosféra. Zľava platí po predložení študentského preukazu.",
        durationMinutes: 60,
        price: 15,
        bufferMinutes: 5,
        sortOrder: 4,
      },
    }),
  ]);

  // Assign all services to all barbers
  for (const barber of barbers) {
    for (const service of services) {
      await prisma.barberService.create({
        data: {
          barberId: barber.id,
          serviceId: service.id,
        },
      });
    }
  }

  // Create schedules: Mon-Fri 9:00-17:00, Sat 9:00-13:00
  for (const barber of barbers) {
    // Monday (1) through Friday (5)
    for (let day = 1; day <= 5; day++) {
      await prisma.schedule.create({
        data: {
          barberId: barber.id,
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "17:00",
          isActive: true,
        },
      });
    }
    // Saturday (6)
    await prisma.schedule.create({
      data: {
        barberId: barber.id,
        dayOfWeek: 6,
        startTime: "09:00",
        endTime: "13:00",
        isActive: true,
      },
    });
  }

  // Create lunch breaks: 12:00-12:30 Mon-Fri for each barber
  for (const barber of barbers) {
    for (let day = 1; day <= 5; day++) {
      await prisma.scheduleBreak.create({
        data: {
          barberId: barber.id,
          dayOfWeek: day,
          startTime: "12:00",
          endTime: "12:30",
          label: "Obed",
        },
      });
    }
  }

  // Create shop settings
  await prisma.shopSettings.create({
    data: {
      slotIntervalMinutes: 60,
    },
  });

  console.log("Seed completed:");
  console.log(`  - ${barbers.length} barbers`);
  console.log(`  - ${services.length} services`);
  console.log(`  - ${barbers.length * services.length} barber-service assignments`);
  console.log(`  - ${barbers.length * 6} schedules`);
  console.log(`  - ${barbers.length * 5} lunch breaks`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
