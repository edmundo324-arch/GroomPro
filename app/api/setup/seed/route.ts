import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { db } from "@/src/lib/db";

const employees = [
  { firstName: "Edmundo", lastName: "Saenz", title: "Owner", role: "ADMIN", pin: "1233" },
  { firstName: "Zagla", lastName: "Saenz", title: "Owner", role: "ADMIN", pin: "4566" },
  { firstName: "Abby", lastName: "Ensing", title: "Manager", role: "MANAGER", pin: "1111" },
  { firstName: "Zagla", lastName: "Paz", title: "Manager", role: "MANAGER", pin: "7899" },
  { firstName: "Ruby", lastName: "Paz", title: "Outside Sales / Marketing", role: "SALES", pin: "0000" },
  { firstName: "Arianna", lastName: "Petro", title: "Sales/CSR", role: "SALES", pin: "9999" },
  { firstName: "Lisa", lastName: "Allen", title: "Groomer", role: "GROOMER", pin: "2222" },
  { firstName: "Kandance", lastName: "Krueger", title: "Groomer", role: "GROOMER", pin: "3333" },
  { firstName: "Hailey", lastName: "Puly", title: "Bather", role: "BACK", pin: "4444" },
  { firstName: "Lyndsey", lastName: "Culwell", title: "Bather", role: "BACK", pin: "6666" },
  { firstName: "Anton", lastName: "Johnson", title: "Bather", role: "BACK", pin: "7777" },
] as const;

const dogBreeds = [
  "Golden Retriever", "Yorkshire Terrier", "Shih Tzu", "Poodle", "Labrador Retriever",
  "Australian Shepherd", "Doodle", "Cocker Spaniel", "German Shepherd", "Maltese",
  "Schnauzer", "French Bulldog", "Cavalier King Charles Spaniel", "Border Collie", "Havanese",
  "Chihuahua", "Bichon Frise", "Pomeranian", "Beagle", "Dachshund",
];

const lastNames = [
  "Jones", "Smith", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson",
  "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Garcia", "Martinez", "Robinson", "Clark",
];

const assetCategories = [
  "Grooming",
  "Full Wash",
  "Self Service",
  "Nail Grinding",
  "VIP Grooming",
  "VIP Full Wash",
  "VIP Brush-out-Session",
  "VIP Self Service",
] as const;

function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.GROOMPRO_SETUP_SECRET;
    if (!expectedSecret || expectedSecret === "replace-with-a-long-random-secret") {
      return NextResponse.json({ error: "GROOMPRO_SETUP_SECRET is not configured." }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.secret !== expectedSecret) {
      return NextResponse.json({ error: "Invalid setup secret." }, { status: 401 });
    }

    const result = await db.$transaction(async (tx) => {
      let tenantId = process.env.GROOMPRO_DEV_TENANT_ID || null;
      let tenant = tenantId ? await tx.tenant.findUnique({ where: { id: tenantId } }) : null;
      if (!tenant) {
        tenant = await tx.tenant.findFirst({ orderBy: { createdAt: "asc" } });
      }
      if (!tenant) {
        tenant = await tx.tenant.create({ data: { name: "Rubber Doggies Grooming" } });
      }
      tenantId = tenant.id;

      let location = await tx.location.findFirst({ where: { tenantId }, orderBy: { createdAt: "asc" } });
      if (!location) {
        location = await tx.location.create({
          data: {
            tenantId,
            name: "Main Location",
            city: "Cibolo",
            state: "TX",
            timezone: "America/Chicago",
          },
        });
      }

      const employeeIds: string[] = [];
      for (const employee of employees) {
        const existing = await tx.user.findFirst({
          where: { tenantId, firstName: employee.firstName, lastName: employee.lastName },
        });
        const pinHash = hashPin(employee.pin);
        const user = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: { role: employee.role as any, active: true, locationId: location.id, pinHash },
            })
          : await tx.user.create({
              data: {
                tenantId,
                locationId: location.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                role: employee.role as any,
                active: true,
                pinHash,
              },
            });
        await tx.$executeRaw`UPDATE User SET jobTitle = ${employee.title} WHERE id = ${user.id}`;
        employeeIds.push(user.id);
      }

      let customerCount = 0;
      for (let i = 1; i <= 20; i++) {
        const firstName = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"][i - 1];
        const lastName = lastNames[i - 1];
        const phone = `21012345${String(i).padStart(2, "0")}`;
        const existingPhone = await tx.customerPhone.findFirst({ where: { tenantId, normalized: phone } });
        let customer = existingPhone
          ? await tx.customer.findUnique({ where: { id: existingPhone.customerId } })
          : await tx.customer.findFirst({ where: { tenantId, firstName, lastName } });

        if (!customer) {
          customer = await tx.customer.create({
            data: { tenantId, firstName, lastName, city: "Cibolo", state: "TX" },
          });
        }

        await tx.customerPhone.upsert({
          where: { tenantId_normalized: { tenantId, normalized: phone } },
          update: { customerId: customer.id, number: `210-123-${phone.slice(-4)}`, isPrimary: true },
          create: {
            tenantId,
            customerId: customer.id,
            number: `210-123-${phone.slice(-4)}`,
            normalized: phone,
            label: "Mobile",
            isPrimary: true,
          },
        });

        const existingDog = await tx.pet.findFirst({ where: { tenantId, customerId: customer.id, name: `Fluffy ${i}` } });
        if (!existingDog) {
          await tx.pet.create({
            data: {
              tenantId,
              customerId: customer.id,
              name: `Fluffy ${i}`,
              breed: dogBreeds[i - 1],
            },
          });
        }
        customerCount++;
      }

      for (const category of assetCategories) {
        const existing = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM BookingAsset WHERE tenantId = ${tenantId} AND locationId = ${location.id} AND category = ${category} LIMIT 1
        `;
        if (existing.length === 0) {
          await tx.$executeRaw`
            INSERT INTO BookingAsset (id, tenantId, locationId, name, category, onlineBookingRecipient, active)
            VALUES (${randomUUID()}, ${tenantId}, ${location.id}, ${category}, ${category}, true, true)
          `;
        }
      }

      return { tenantId, locationId: location.id, employeeCount: employeeIds.length, customerCount, assetCount: assetCategories.length };
    });

    return NextResponse.json({ ok: true, seeded: result });
  } catch (error) {
    console.error("Seed failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Seed failed." }, { status: 500 });
  }
}
