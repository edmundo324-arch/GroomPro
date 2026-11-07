import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { preparedFixtureHash, preparedFixtureSource, readPreparedFixture } from './prepared-test-data';

// Public destinations for routing fictional demo clients, not residential data.
const destinations = [
  ['3864 Cibolo Valley Drive', ''],
  ['4093 Green Valley Road', ''],
  ['850 FM 1103', 'Suite 100'],
  ['602 Cibolo Valley Drive', ''],
  ['200 South Main Street', ''],
  ['108 Cibolo Drive', 'Building 3'],
  ['200 Schlather Street', ''],
];
const nameKey = (first: unknown, last: unknown) => [first, last].map(part => String(part || '').trim().toLowerCase()).join(' ');

export async function preparedCustomerAddresses(db: PrismaClient, tenantId: string, actorId: string, apply: boolean) {
  const dataset = (await readPreparedFixture()).find(entry => entry.entity === 'CUSTOMER');
  if (!dataset) throw Error('The prepared customer fixture is missing.');
  const records = new Map(dataset.rows.map(row => [String(row[dataset.idColumn]), nameKey(row.FirstName, row.LastName)]));
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
    const links = await tx.importRecord.findMany({
      where: { tenantId, source: preparedFixtureSource, entityType: 'CUSTOMER', sourceId: { in: [...records.keys()] } },
      select: { targetId: true, sourceId: true, payload: true },
    });
    const sourceForTarget = new Map([...records.keys()].map(id => [id, id]));
    for (const link of links) {
      if (link.targetId && (link.payload as { preparedFixture?: string } | null)?.preparedFixture === preparedFixtureHash) {
        sourceForTarget.set(link.targetId, link.sourceId);
      }
    }
    const customers = await tx.customer.findMany({
      where: { tenantId, id: { in: [...sourceForTarget.keys()] } },
      select: { id: true, firstName: true, lastName: true, address1: true, address2: true, city: true, state: true, postalCode: true },
    });
    const matched = customers.filter(customer => records.get(sourceForTarget.get(customer.id)!) === nameKey(customer.firstName, customer.lastName));
    const blank = matched.filter(customer => ![customer.address1, customer.address2, customer.city, customer.state, customer.postalCode].some(value => value?.trim()));
    const counts = { ADDRESS: { added: blank.length, existing: matched.length - blank.length } };
    if (!matched.length) return { applied: false, issues: ['No matching prepared demo customers were found in this business.'], counts };
    if (!apply) return { applied: false, issues: [], counts };
    let updated = 0;
    for (const customer of blank) {
      const sourceId = sourceForTarget.get(customer.id)!;
      const [address1, address2] = destinations[createHash('sha256').update(sourceId).digest()[0] % destinations.length];
      const result = await tx.customer.updateMany({
        where: { id: customer.id, tenantId, address1: customer.address1, address2: customer.address2, city: customer.city, state: customer.state, postalCode: customer.postalCode },
        data: { address1, address2: address2 || null, city: 'Cibolo', state: 'TX', postalCode: '78108' },
      });
      updated += result.count;
    }
    if (updated) await tx.auditEntry.create({ data: { tenantId, actorType: 'EMPLOYEE', actorUserId: actorId, entityType: 'TENANT', entityId: tenantId,
      action: 'PREPARED_CUSTOMER_ADDRESSES', summary: 'Filled blank addresses on prepared fictional customers.', details: { updated, fixture: preparedFixtureHash } } });
    return { applied: true, issues: [], counts: { ADDRESS: { added: updated, existing: matched.length - updated } } };
  }, { timeout: 30000 });
}
