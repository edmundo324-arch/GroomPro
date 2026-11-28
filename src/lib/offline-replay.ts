import {scheduleSnapshot} from './offline-schedule-store';
import {catalogVersion} from './catalog-version';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import { offlineAction, offlineRecordId, offlineRecordVersion, type OfflineTarget } from './offline-actions';
import { offlineTransaction } from './offline-transaction';
import { requestLocation } from './request-location';

class Rejected extends Error {
  constructor(readonly response: Response) { super('Offline action rejected'); }
}

async function currentRecord(tx: Prisma.TransactionClient, tenantId: string, locationId: string, target: OfflineTarget) {
  if(target.entity==='schedules')return scheduleSnapshot(tenantId,tx);
  const where = { id: target.id, tenantId };
  if(target.entity==='service')return tx.service.findFirst({where});
  if(target.entity==='package'){const row=await tx.package.findFirst({where,include:{items:{orderBy:{sortOrder:'asc'}}}});return row?{...row,_offlineVersion:catalogVersion(row)}:null;}
  if (target.entity === 'customer') return tx.customer.findFirst({ where, include: { phones: true } });
  if (target.entity === 'pet') return tx.pet.findFirst({ where, include: { vaccinations: true } });
  if (target.entity === 'draft') return tx.posDraft.findFirst({ where: { ...where, locationId } });
  return tx.ticket.findFirst({ where: { ...where, locationId }, include: { lines: true, pets: true, assignments: true } });
}

export async function replayOffline(request: NextRequest, tenantId: string, employeeId: string, invoke: () => Promise<Response>) {
  let metadata, body;
  const raw = await request.clone().text();
  try {
    metadata = JSON.parse(decodeURIComponent(request.headers.get('x-groompro-offline') || ''));
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid offline save.' }, { status: 400 });
  }
  const action = offlineAction(request.nextUrl, request.method, body);
  if (!action || !metadata || !/^[a-f0-9-]{36}$/i.test(metadata.id || '') || raw.length > 300000) {
    return NextResponse.json({ error: 'Invalid offline save.' }, { status: 400 });
  }
  const locationId = await requestLocation(request, tenantId);
  if (!locationId || metadata.locationId !== locationId || metadata.tenantId !== tenantId || metadata.employeeId !== employeeId) {
    return NextResponse.json({ error: 'Sign in as the employee who saved this change, at its original location.', code: 'OFFLINE_SCOPE_MISMATCH' }, { status: 403 });
  }
  const target = action.target;
  const key = { tenantId, requestKey: 'offline:' + metadata.id };
  const requestHash = createHash('sha256').update(JSON.stringify([employeeId, locationId, request.method, request.nextUrl.pathname, request.nextUrl.search, raw])).digest('hex');
  try {
    return await db.$transaction(async tx => {
      // Serialize replay for a business. Serializable isolation also protects
      // the version check against regular online writes to the same record.
      await tx.$queryRaw`SELECT id FROM Tenant WHERE id=${tenantId} FOR UPDATE`;
      const receipt = await tx.posOperation.findUnique({ where: { tenantId_requestKey: key } });
      if (receipt) {
        if (receipt.requestHash !== requestHash) throw new Rejected(NextResponse.json({ error: 'Offline save ID already used.' }, { status: 409 }));
        return NextResponse.json(receipt.response, { status: receipt.responseStatus || 200 });
      }
      let checkedInAt: Date | undefined;
      if (target) {
        const record = await currentRecord(tx, tenantId, locationId, target);
        if (!record || metadata.live !== true && offlineRecordVersion(record) !== metadata.version) {
          throw new Rejected(NextResponse.json({
            error: 'This record changed on GoDaddy. Your device changes are still saved.',
            offlineConflict: true, cloud: record,
          }, { status: 409 }));
        }
        const checkIn = (request.nextUrl.pathname === '/api/tickets/status' && body.status === 'CHECKED_IN' && !body.action) ||
          (request.nextUrl.pathname === '/api/pos-operation' && body.kind === 'STATUS' && body.details?.status === 'CHECKED_IN' && !body.details?.action);
        if (checkIn && metadata.live !== true && metadata.createdAt !== undefined) {
          // Only the scoped, version-checked replay can supply a device time.
          const createdAt = 'createdAt' in record ? Number(record.createdAt) : 0;
          if (!Number.isSafeInteger(metadata.createdAt) || metadata.createdAt <= 0 || metadata.createdAt > Date.now() + 300000 || createdAt && metadata.createdAt < createdAt)
            throw new Rejected(NextResponse.json({ error: 'The saved check-in time does not match this appointment. Review the device change before retrying.' }, { status: 409 }));
          checkedInAt = new Date(metadata.createdAt);
        }
      }
      const id = offlineRecordId(metadata.id);
      const response = await offlineTransaction.run({ tx, recordId: id, checkedInAt }, invoke);
      if (!response.ok) throw new Rejected(response);
      const result = await response.json();
      // Keep the acknowledgement small. The client refreshes the full record.
      const touched = target && await currentRecord(tx, tenantId, locationId, target);
      const versions: Record<string, string> = {};
      if (target && touched) versions[target.entity + ':' + target.id] = offlineRecordVersion(touched)!;
      for (const entity of ['customer', 'pet', 'ticket', 'draft'] as const) {
        if (result[entity]?.id && result[entity]?.updatedAt) {
          // A handler can write displayStatus after building its response.
          // Chain the next edit to the final database version already read above.
          versions[entity + ':' + result[entity].id] ??= new Date(result[entity].updatedAt).toISOString();
        }
      }
      if(result.item?.id&&['service','package'].includes(action.create||target?.entity||'')){const entity=(action.create||target!.entity) as 'service'|'package';const saved=await currentRecord(tx,tenantId,locationId,{entity,id:result.item.id});if(saved)versions[entity+':'+result.item.id]=offlineRecordVersion(saved)!;}
      if (result.savedTicketId && !versions['ticket:' + result.savedTicketId]) {
        const ticket = await currentRecord(tx, tenantId, locationId, { entity: 'ticket', id: result.savedTicketId });
        if (ticket) versions['ticket:' + ticket.id] = offlineRecordVersion(ticket)!;
      }
      const data = { ...result, offlineVersions: versions };
      await tx.posOperation.create({
        data: { id: randomUUID(), ...key, requestHash, status: 'DONE', response: data, responseStatus: response.status },
      });
      return NextResponse.json(data, { status: response.status });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 45000 });
  } catch (error) {
    if (error instanceof Rejected) return error.response;
    return NextResponse.json({ error: 'GoDaddy could not confirm this save. GroomPro will retry it.' }, { status: 503 });
  }
}
