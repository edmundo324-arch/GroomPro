// Shared by the device queue and the server. Financial and external actions
// have their own confirmation workflow and must never be replayed here.
export type OfflineEntity = 'customer' | 'pet' | 'ticket' | 'draft' | 'service' | 'package' | 'schedules';
export type OfflineTarget = { entity: OfflineEntity; id: string };
export type OfflineScope = { tenantId: string; locationId: string; employeeId: string };
export type OfflineVersion = string | null;
export type OfflineCommand = OfflineScope & {
  id: string; url: string; method: string; body: string;
  version?: OfflineVersion; follows?: string; createdAt: number;
  attendanceDecision?:{ticketId:string;from:string;to:string};attendanceChoice?:{ticketId:string;from:string;to:string;send:boolean};
  issue?: string; cloud?: unknown; warning?: string; overrides?: string[]; directUntil?: number;
};

const ticketWrites = new Set([
  '/api/tickets/status', '/api/tickets/presentation', '/api/tickets/timing',
  '/api/tickets/groomer', '/api/tickets/planned-packages', '/api/tickets/customer',
  '/api/tickets/pets', '/api/tickets/package', '/api/tickets/line-times', '/api/tickets/daycare',
  '/api/ticket-lines', '/api/calendar/move-pet',
]);

export function offlineAction(url: URL, method: string, body: any): { create?: OfflineEntity; target?: OfflineTarget } | null {
  if (!body || typeof body !== 'object' || !['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return null;
  const path = url.pathname;
  const target = (entity: OfflineEntity, id: unknown) =>
    typeof id === 'string' && id.length > 0 && id.length <= 191 ? { target: { entity, id } } : null;
  if(['/api/employee-schedules','/api/booking-assets/schedules','/api/schedule-overrides'].includes(path)&&['PUT','DELETE'].includes(method))return {target:{entity:'schedules',id:'all'}};
  if(path==='/api/staff-tasks'&&method==='POST'&&['SAVE','COMPLETE','REOPEN'].includes(body.action))return {};
  if(path==='/api/time-clock'&&method==='POST'&&['IN','OUT','BREAK_START','BREAK_END','CORRECT'].includes(body.action))return {};
  if(path==='/api/catalog'&&['services','packages'].includes(body.kind)){if(body.applyTo&&body.applyTo!=='NONE')return null;const entity=body.kind==='services'?'service':'package';return method==='POST'?{create:entity}:method==='PATCH'?target(entity,body.id):null;}
  if (path === '/api/customers' && method === 'POST') return { create: 'customer' };
  const customer = /^\/api\/customers\/([^/]+)$/.exec(path);
  if (customer && method === 'PATCH' && !['account', 'rewards', 'location-access', 'payment-methods'].includes(customer[1])) return target('customer', customer[1]);
  if (path === '/api/pets') return method === 'POST' ? { create: 'pet' } : method === 'PATCH' ? target('pet', body.id) : null;
  if (path === '/api/pos-drafts') return method === 'POST' ? { create: 'draft' } : method === 'PUT' ? target('draft', body.id) : null;
  if (path === '/api/grooming-notes' && method === 'PATCH') {
    return body.permanent ? target(body.permanent === 'CUSTOMER' ? 'customer' : 'pet', body.entityId) : body.id ? {} : null;
  }
  if (path === '/api/pos-operation' && method === 'POST') {
    if (body.kind === 'SAVE' && !body.ticketId) return body.draft?.draftId ? target('draft', body.draft.draftId) : { create: 'ticket' };
    if (['SAVE', 'STATUS', 'REBOOK'].includes(body.kind)) return target('ticket', body.ticketId);
    return null;
  }
  if (path === '/api/tickets' && method === 'POST' && body.bookingSource !== 'ONLINE') return body.draftId ? target('draft', body.draftId) : { create: 'ticket' };
  if (path === '/api/tickets/visit-history' && method === 'PATCH') return target('ticket', body.ticketId);
  if (path === '/api/tickets' && method === 'PATCH' || ticketWrites.has(path) ||
      path === '/api/tickets/rebook' && method === 'POST' ||
      path === '/api/whiteboard' && method === 'PATCH' && body.action === 'PRIORITY') {
    return target('ticket', body.ticketId || url.searchParams.get('ticketId'));
  }
  return null;
}

export const offlineRecordId = (id: string) => 'offline-' + id;
export const offlineScopeKey = (s: OfflineScope) => JSON.stringify([s.tenantId, s.locationId, s.employeeId]);
export const offlineTargetKey = (t: OfflineTarget) => t.entity + ':' + t.id;

export function offlineRecordVersion(record:any):string|null {const value=record?._offlineVersion||record?.updatedAt;return value instanceof Date?value.toISOString():typeof value==='string'?value:null;}

export function offlineAttendanceChoice(command:OfflineCommand,send:boolean){
 const decision=command.attendanceDecision;
 if(!decision||typeof decision.ticketId!=='string'||!Number.isFinite(+new Date(decision.from))||!Number.isFinite(+new Date(decision.to)))throw Error('Refresh this offline change before choosing whether to send confirmation.');
 return {...decision,send};
}
