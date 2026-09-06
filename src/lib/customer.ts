import { db } from "./db";

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function searchCustomers(tenantId: string, query: string) {
  const text = normalizeText(query);
  const phone = normalizePhone(query);

  if (!text && !phone) return [];

  return db.customer.findMany({
    where: {
      tenantId,
      active: true,
      OR: [
        ...(phone.length >= 7 ? [{ phones: { some: { tenantId, normalized: { contains: phone } } } }] : []),
        { firstName: { contains: text } },
        { lastName: { contains: text } },
        { email: { contains: text } },
        { pets: { some: { name: { contains: text } } } },
      ],
    },
    include: {
      phones: { orderBy: { isPrimary: "desc" } },
      pets: { where: { active: true }, orderBy: { name: "asc" } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 25,
  });
}

export async function findPossibleDuplicateCustomer(
  tenantId: string,
  input: { firstName: string; lastName: string; email?: string; phone?: string },
) {
  const normalizedPhone = input.phone ? normalizePhone(input.phone) : "";
  const email = input.email?.trim().toLowerCase();

  return db.customer.findFirst({
    where: {
      tenantId,
      active: true,
      OR: [
        ...(normalizedPhone ? [{ phones: { some: { tenantId, normalized: normalizedPhone } } }] : []),
        ...(email ? [{ email: { equals: email } }] : []),
        {
          firstName: { equals: normalizeText(input.firstName) },
          lastName: { equals: normalizeText(input.lastName) },
        },
      ],
    },
    include: { phones: true, pets: { where: { active: true } } },
  });
}

export async function getCustomerProfile(tenantId: string, customerId: string) {
  return db.customer.findFirst({
    where: { id: customerId, tenantId, active: true },
    include: {
      phones: { orderBy: { isPrimary: "desc" } },
      pets: {
        where: { active: true },
        include: { vaccinations: { orderBy: { expiresAt: "desc" } } },
        orderBy: { name: "asc" },
      },
      tickets: {
        orderBy: [{ scheduledStart: "desc" }, { createdAt: "desc" }],
        take: 20,
        include: { pets: { include: { pet: true } }, lines: true, payments: true },
      },
      communications: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
}
