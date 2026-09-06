import { db } from "./db";

export type BookingConflict = {
  type: "OVERLAP" | "RECENT";
  orderNumber: number;
  scheduledStart: Date;
  petNames: string[];
  message: string;
};

export async function checkCustomerBookingRules(tenantId: string, customerId: string, start: Date, durationMin: number) {
  const end = new Date(start.getTime() + durationMin * 60000);
  const lookback = new Date(start.getTime() - 14 * 86400000);
  const lookahead = new Date(end.getTime() + 14 * 86400000);
  const tickets = await db.ticket.findMany({
    where: { tenantId, customerId, scheduledStart: { gte: lookback, lte: lookahead }, status: { notIn: ["CANCELLED", "CLOSED"] } },
    include: { pets: { include: { pet: { select: { name: true } } } } },
    orderBy: { scheduledStart: "asc" },
  });
  const conflicts: BookingConflict[] = [];
  for (const t of tickets) {
    if (!t.scheduledStart) continue;
    const tEnd = new Date(t.scheduledStart.getTime() + t.durationMin * 60000);
    const petNames = t.pets.map(x => x.pet.name);
    if (t.scheduledStart < end && tEnd > start) {
      conflicts.push({ type: "OVERLAP", orderNumber: t.orderNumber, scheduledStart: t.scheduledStart, petNames, message: `Customer already has order #${t.orderNumber} at ${t.scheduledStart.toLocaleString()}.` });
    } else if (Math.abs(t.scheduledStart.getTime() - start.getTime()) <= 14 * 86400000) {
      conflicts.push({ type: "RECENT", orderNumber: t.orderNumber, scheduledStart: t.scheduledStart, petNames, message: `Customer has another appointment, order #${t.orderNumber}, within two weeks.` });
    }
  }
  return { conflicts, hardOverlap: conflicts.some(c => c.type === "OVERLAP") };
}

export async function getOnlineBookingRules(tenantId: string, locationId: string) {
  return db.onlineBookingRule.findMany({ where: { tenantId, locationId, enabled: true }, orderBy: { category: "asc" } });
}
