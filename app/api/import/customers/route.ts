import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";
import { writeAudit } from "@/src/lib/audit";

const SESSION_COOKIE = "groompro_session";
function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }

export const runtime = "nodejs";

type Mapping = Record<string, string>;
type ImportRow = Record<string, string>;

function clean(v: unknown) { return String(v ?? "").trim(); }
function normalizePhone(v: string) { return v.replace(/\D/g, ""); }

export async function POST(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  const session = sessionId ? await getActiveEmployeeSession(tenantId, sessionId) : null;
  if (!tenantId || !session) return NextResponse.json({ error: "Employee PIN is required before importing customer data." }, { status: 401 });

  let body: { rows?: ImportRow[]; mapping?: Mapping; locationId?: string; dryRun?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid import request." }, { status: 400 }); }
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 10000) : [];
  const mapping = body.mapping || {};
  if (!rows.length) return NextResponse.json({ error: "The import contains no rows." }, { status: 400 });

  const field = (row: ImportRow, name: string) => {
    const header = Object.keys(mapping).find(h => mapping[h] === name);
    return header ? clean(row[header]) : "";
  };

  const errors: { row: number; message: string }[] = [];
  let customersCreated = 0, customersMatched = 0, petsCreated = 0;
  const preview = [] as { row: number; action: string; customer: string; pets: string[] }[];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstName = field(row, "firstName");
    const lastName = field(row, "lastName");
    const email = field(row, "email").toLowerCase();
    const phone = field(row, "phone");
    const normalized = normalizePhone(phone);
    if (!firstName && !lastName) { errors.push({ row: i + 2, message: "Customer first or last name is required." }); continue; }
    if (!normalized && !email) { errors.push({ row: i + 2, message: "A phone number or email is required to safely match/create a customer." }); continue; }

    const existing = normalized ? await db.customerPhone.findFirst({ where: { tenantId, normalized }, include: { customer: true } }) : email ? await db.customer.findFirst({ where: { tenantId, email } }) : null;
    const petNames = [1,2,3,4,5].map(n => field(row, `dog${n}Name`)).filter(Boolean);
    preview.push({ row: i + 2, action: existing ? "MATCH" : "CREATE", customer: `${firstName} ${lastName}`.trim(), pets: petNames });
    if (body.dryRun) continue;

    let customer = existing?.customer || existing;
    if (customer) customersMatched++;
    else {
      customer = await db.customer.create({ data: { tenantId, firstName: firstName || "Imported", lastName: lastName || "Customer", email: email || null } });
      customersCreated++;
    }

    if (normalized) {
      const phoneExists = await db.customerPhone.findFirst({ where: { tenantId, normalized } });
      if (!phoneExists) await db.customerPhone.create({ data: { tenantId, customerId: customer.id, number: phone, normalized, isPrimary: true } });
    }

    const addressParts = [field(row, "address"), field(row, "city"), field(row, "state"), field(row, "postalCode")].filter(Boolean);
    if (addressParts.length) {
      const marker = `Imported address: ${addressParts.join(", ")}`;
      await db.customer.update({ where: { id: customer.id }, data: { notes: customer.notes ? `${customer.notes}\n${marker}` : marker } });
    }

    for (let n = 1; n <= 5; n++) {
      const dogName = field(row, `dog${n}Name`);
      if (!dogName) continue;
      const dogBreed = field(row, `dog${n}Breed`);
      const samePet = await db.pet.findFirst({ where: { tenantId, customerId: customer.id, name: dogName, active: true } });
      if (!samePet) { await db.pet.create({ data: { tenantId, customerId: customer.id, name: dogName, breed: dogBreed || null } }); petsCreated++; }
    }
  }

  if (!body.dryRun) await writeAudit({ tenantId, actorUserId: session.user.id, entityType: "CUSTOMER", entityId: tenantId, action: "IMPORT", summary: `Imported customer data: ${customersCreated} created, ${customersMatched} matched, ${petsCreated} pets added.`, details: { rows: rows.length, errors: errors.length, locationId: body.locationId || null } });
  return NextResponse.json({ ok: true, dryRun: !!body.dryRun, preview, errors, totals: { rows: rows.length, customersCreated, customersMatched, petsCreated } });
}
