import { db } from "./db";

export async function getCalendarTickets(tenantId: string, locationId: string, start: Date, end: Date) {
  return db.ticket.findMany({
    where: { tenantId, locationId, scheduledStart: { gte: start, lt: end }, status: { not: "CANCELLED" } },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phones: { select: { number: true, normalized: true, label: true, isPrimary: true } },
        },
      },
      pets: { include: { pet: { select: { id: true, name: true, breed: true } } } },
      lines: { select: { id: true, lineType: true, description: true, totalCents: true } },
      assignments: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
    },
    orderBy: { scheduledStart: "asc" },
  });
}
