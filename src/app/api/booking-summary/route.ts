import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";

export async function GET(request: NextRequest) {
  const serviceId = request.nextUrl.searchParams.get("serviceId");
  const barberId = request.nextUrl.searchParams.get("barberId");

  if (!serviceId || !barberId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const barberService = await prisma.barberService.findUnique({
    where: { barberId_serviceId: { barberId, serviceId } },
    include: {
      service: true,
      barber: { select: { firstName: true, lastName: true } },
    },
  });

  if (!barberService) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { service, barber } = barberService;
  const duration = barberService.customDuration ?? service.durationMinutes;
  const price = barberService.customPrice ?? service.price;

  return NextResponse.json({
    serviceName: service.name,
    barberName: `${barber.firstName} ${barber.lastName}`,
    duration,
    price: price.toString(),
  });
}
