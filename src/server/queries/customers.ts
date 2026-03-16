import { prisma } from "@/server/lib/prisma";
import { PAGE_SIZE } from "@/lib/constants";

export async function getCustomers(page = 1, search?: string) {
  const where = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.customer.count({ where }),
  ]);

  return { items, total, pages: Math.ceil(total / PAGE_SIZE) };
}

export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      appointments: {
        include: {
          barber: { select: { firstName: true, lastName: true } },
          service: { select: { name: true } },
        },
        orderBy: { startTime: "desc" },
      },
    },
  });
}
