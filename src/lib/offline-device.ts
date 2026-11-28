"use client";
import {downloadReportHistory,type ReportHistory} from './offline-report-history';
import {offlineReport,offlineShopComparison} from './offline-report';
import { offlineAttendanceChoice, offlineRecordId, offlineAction, offlineRecordVersion, offlineScopeKey, offlineTargetKey, type OfflineCommand, type OfflineScope } from './offline-actions';
import { reportHistoryInfoKey, reportHistoryKey, deviceRead, deviceUpdate, emptyOutbox, outboxKey, snapshotKey, type OfflineOutbox } from './offline-device-store';
import { findRecord, offlineReadRecords, projectOffline, type OfflineRecords } from './offline-records';

const activeKey = 'active-employee';
const lookups = ['/api/customer-tags','/api/staff-tasks','/api/offline/schedules','/api/booking-assets','/api/locations','/api/time-clock','/api/catalog', '/api/operating-hours', '/api/workflow-settings', '/api/customer-display', '/api/pet-display', '/api/breeds', '/api/features'];
type ActiveDevice = { scope: OfflineScope; validUntil: number };
let syncing: Promise<void> | null = null;
let preparing: Promise<void> | null = null;
let preparingScope = '';
let identityRevision = 0;
let unreachableUntil = 0;
let localAccessBlocked = false;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'X-GroomPro-Device': 'true' },
});
function change() { window.dispatchEvent(new Event('groompro:offline-changed')); }
const same = (left: OfflineScope, right: OfflineScope) => offlineScopeKey(left) === offlineScopeKey(right);
const ticketSyncChannel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('groompro:ticket-sync') : null;
ticketSyncChannel?.addEventListener('message', async event => {
  const detail = event.data;
  if (!detail?.offlineSync || typeof detail.ticketId !== 'string') return;
  const active = await activeDevice();
  if (active && active.scope.tenantId === detail.tenantId && active.scope.locationId === detail.locationId)
    window.dispatchEvent(new CustomEvent('groompro:ticket-changed', { detail }));
});
function ticketSynced(scope: OfflineScope, ticketId: string) {
  const detail = { tenantId: scope.tenantId, locationId: scope.locationId, ticketId, offlineSync: true };
  window.dispatchEvent(new CustomEvent('groompro:ticket-changed', { detail }));
  ticketSyncChannel?.postMessage(detail);
}

async function activeDevice(): Promise<ActiveDevice | undefined> {
  if (localAccessBlocked) return;
  try {
    const active = await deviceRead<ActiveDevice>(activeKey);
    if (active && active.validUntil > Date.now()) return active;
  } catch { /* Storage may be unavailable in a private window. */ }
}

export async function offlineStatus() {
  const active = await activeDevice();
  if (!active) return { ready: false, pending: [], archived: [], lastSaved: 0, signInRequired: false,reportSavedAt:0 };
  const [state, queue, history] = await Promise.all([
    deviceRead<OfflineRecords>(snapshotKey(active.scope)),
    deviceRead<OfflineOutbox>(outboxKey(active.scope)),
    deviceRead<Pick<ReportHistory,'asOf'>>(reportHistoryInfoKey(active.scope)),
  ]);
  return { reportSavedAt:history?Date.parse(history.asOf):0, ready: Boolean(state), pending: queue?.pending || [], archived: queue?.archived || [], lastSaved: state?.fetchedAt || 0, signInRequired: Boolean(queue?.signInRequired) };
}

export async function stopOfflineAccess() {
  localAccessBlocked = true;
  identityRevision++;
  await deviceUpdate<ActiveDevice>(activeKey, () => undefined).catch(() => {});
  change();
}

async function refreshDevice(scope: OfflineScope) {
  const revision = identityRevision;
  const existing = await deviceRead<OfflineRecords>(snapshotKey(scope));
  const previous = await deviceRead<OfflineOutbox>(outboxKey(scope));
  // Preserve the bases used by device edits until every pending change is confirmed.
  if (existing && previous?.pending.length) return;
  const response = await fetch('/api/offline/snapshot?' + new URLSearchParams({ locationId: scope.locationId }), { cache: 'no-store' });
  if (!response.ok) return;
  const snapshot: OfflineRecords = await response.json();
  if (!same(scope, snapshot.scope) || revision !== identityRevision) return;
  const requestLookups = [...lookups,
    '/api/calendar?' + new URLSearchParams({ start: snapshot.start, end: new Date(+new Date(snapshot.start) + 86400000).toISOString(), locationId: scope.locationId }),
    '/api/offline/staff?' + new URLSearchParams({ locationId: scope.locationId }),
  ];
  const results = await Promise.all(requestLookups.map(async url => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return [url.split('?')[0].replace('/offline/staff', '/employees'), await res.json()] as const;
    } catch { /* Keep the last complete copy. */ }
    return null;
  }));
  snapshot.lookups = { ...existing?.lookups, ...Object.fromEntries(results.filter(result => result !== null)) };
  if (!['/api/catalog', '/api/operating-hours', '/api/calendar', '/api/employees'].every(url => snapshot.lookups[url])) return;
  const latest = await deviceRead<OfflineOutbox>(outboxKey(scope));
  if (latest?.pending.length || latest?.confirmed.at(-1)?.command.id !== previous?.confirmed.at(-1)?.command.id || revision !== identityRevision) return;
  await deviceUpdate<OfflineRecords>(snapshotKey(scope), () => snapshot);
  const confirmed = new Set(previous?.confirmed.map(entry => entry.command.id));
  await deviceUpdate<OfflineOutbox>(outboxKey(scope), queue => queue && ({
    ...queue, confirmed: queue.confirmed.filter(entry => !confirmed.has(entry.command.id)),
  }));
  await deviceUpdate<ActiveDevice>(activeKey, current => revision === identityRevision ? {
    scope, validUntil: Date.now() + 12 * 60 * 60 * 1000,
  } : current);
  if (revision === identityRevision) localAccessBlocked = false;
  if (typeof navigator.storage?.persist === 'function') void navigator.storage.persist().catch(() => {});
  change();
  // Keep reporting history separate from editable records and their conflict bases.
  try {
    async function prepareHistory(reportScope:OfflineScope){
      const previousHistory=await deviceRead<Pick<ReportHistory,'accessKey'|'canManageTime'>>(reportHistoryInfoKey(reportScope));
      const discardHistory=async()=>{await deviceUpdate(reportHistoryKey(reportScope),()=>undefined);await deviceUpdate(reportHistoryInfoKey(reportScope),()=>undefined)};
      const history=await downloadReportHistory(async(part,after)=>{
        const result=await fetch('/api/offline/report-history?'+new URLSearchParams({locationId:reportScope.locationId,part,after}),{cache:'no-store'});
        if(!result.ok){if([401,403].includes(result.status))await discardHistory();throw Error('Reporting history is unavailable.');}
        const page=await result.json();if(previousHistory&&(previousHistory.accessKey!==page.accessKey||previousHistory.canManageTime!==page.canManageTime))await discardHistory();return page;
      },()=>revision===identityRevision&&navigator.onLine);
      if(history&&same(reportScope,history.scope)&&revision===identityRevision){await deviceUpdate<ReportHistory>(reportHistoryKey(reportScope),()=>history);await deviceUpdate(reportHistoryInfoKey(reportScope),()=>({asOf:history.asOf,accessKey:history.accessKey,canManageTime:history.canManageTime}));return history;}
      return null;
    }
    const history=await prepareHistory(scope),manifestKey='report-shops:'+offlineScopeKey(scope);
    if(history?.canManageTime){
      await deviceUpdate(manifestKey,()=>undefined);
      const response=await fetch('/api/reports?locations=1',{cache:'no-store'});if(!response.ok)throw Error('Shop list unavailable.');const data=await response.json();
      const locations=Array.isArray(data.locations)?data.locations:[];
      if(!locations.some((l:any)=>l.id===scope.locationId))throw Error('Shop list changed.');
      for(const location of locations){if(location.id===scope.locationId)continue;if(!await prepareHistory({...scope,locationId:location.id}))throw Error('Shop history incomplete.');}
      if(revision===identityRevision)await deviceUpdate(manifestKey,()=>({scope,locations,accessKey:history.accessKey}));
    }else await deviceUpdate(manifestKey,()=>undefined);

  } catch { /* Retain the last complete history after interrupted downloads. */ }
  change();
}

export function prepareOffline(scope: OfflineScope) {
  const key = offlineScopeKey(scope);
  if (preparing && preparingScope === key) return preparing;
  preparingScope = key;
  const task = (async () => {
    if (!navigator.onLine) return;
    const current = await activeDevice();
    if (current && !same(current.scope, scope)) await stopOfflineAccess();
    // A fresh online sign-in for this same employee also unlocks an outbox
    // whose prior offline session expired.
    const saved = await deviceRead<OfflineRecords>(snapshotKey(scope));
    if (saved) {
      const revision = identityRevision;
      await deviceUpdate<ActiveDevice>(activeKey, current => revision === identityRevision ? ({ scope, validUntil: Date.now() + 12 * 60 * 60 * 1000 }) : current);
      if (revision === identityRevision) localAccessBlocked = false;
    }
    await refreshDevice(scope);
    void syncOffline();
  })().catch(() => change());
  preparing = task;
  void task.finally(() => { if (preparing === task) preparing = null; });
  return task;
}

async function projected(active: ActiveDevice) {
  const snapshot = await deviceRead<OfflineRecords>(snapshotKey(active.scope));
  if (!snapshot) return null;
  const queue = await deviceRead<OfflineOutbox>(outboxKey(active.scope)) || emptyOutbox();
  for (const entry of queue.confirmed) {
    try {
      projectOffline(snapshot, entry.command);
      for (const [key, version] of Object.entries(entry.result.offlineVersions || {})) {
        const colon = key.indexOf(':');
        const record = findRecord(snapshot, key.slice(0, colon), key.slice(colon + 1));
        if(record){if(key.startsWith('package:')||key.startsWith('schedules:'))record._offlineVersion=version;else record.updatedAt=version;}
      }
      if(entry.result.task&&snapshot.lookups['/api/staff-tasks']){const rows=snapshot.lookups['/api/staff-tasks'].tasks,index=rows.findIndex((t:any)=>t.id===entry.result.task.id);if(index<0)rows.push(entry.result.task);else rows[index]=entry.result.task;}
      if(entry.result.clock&&snapshot.lookups['/api/time-clock'])snapshot.lookups['/api/time-clock'].clocks[entry.result.userId]=entry.result.clock;
      if (entry.result.ticket) {
        const record = findRecord(snapshot, 'ticket', entry.result.ticket.id);
        if (record) Object.assign(record, { arrivalPriorityPending: false }, entry.result.ticket);
      }
    } catch { /* The cloud receipt still confirms the saved operation. */ }
  }
  for (const command of queue.pending) {
    try { projectOffline(snapshot, command); } catch { /* Keep the original command available for review. */ }
  }
  return { snapshot, queue };
}

function pendingReportTickets(data:{snapshot:OfflineRecords;queue:OfflineOutbox}|null){
 if(!data)return [];
const ids=new Set<string>();for(const command of data.queue.pending){try{const body=JSON.parse(command.body),action=offlineAction(new URL(command.url,location.origin),command.method,body);if(action?.target?.entity==='ticket'||action?.target?.entity==='draft')ids.add(action.target.id);if(action?.create==='ticket'||body.kind==='REBOOK'||new URL(command.url,location.origin).pathname==='/api/tickets/rebook')ids.add(offlineRecordId(command.id));}catch{}}
 return data.snapshot.tickets.filter(t=>ids.has(t.id));
}

export async function offlineBootstrap() {
  const active = await activeDevice();
  const state = active && await deviceRead<OfflineRecords>(snapshotKey(active.scope));
  return state ? { employee: state.employee, scope: state.scope, features: state.lookups['/api/features']?.features || [] } : null;
}

function sendCommand(command: OfflineCommand, version: OfflineCommand['version'], live?: RequestInit) {
  const url = new URL(command.url, window.location.origin);
  if (!url.searchParams.has('locationId')) url.searchParams.set('locationId', command.locationId);
  const metadata = { id: command.id, tenantId: command.tenantId, locationId: command.locationId, employeeId: command.employeeId, createdAt: command.createdAt, version, live: Boolean(live) };
  const headers = new Headers(live?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-groompro-offline', encodeURIComponent(JSON.stringify(metadata)));
  if(command.attendanceChoice)headers.set('x-groompro-attendance-choice',JSON.stringify(command.attendanceChoice));
  if (command.overrides?.length) headers.set('x-groompro-scheduling-overrides', encodeURIComponent(JSON.stringify(command.overrides)));
  return fetch(url, { ...live, method: command.method, body: command.body || '{}', headers, cache: 'no-store' });
}

async function confirmCommand(key: string, command: OfflineCommand, result: any) {
  await deviceUpdate<OfflineOutbox>(key, latest => {
    if (!latest?.pending.some(entry => entry.id === command.id)) return latest;
    return { ...latest, signInRequired: false, pending: latest.pending.filter(entry => entry.id !== command.id),
      confirmed: [...latest.confirmed, { command, result }] };
  });
}

async function saveOnDevice(active: ActiveDevice, url: URL, method: string, raw: string, live?: RequestInit) {
  const body = JSON.parse(raw || '{}');
  const action = offlineAction(url, method, body);
  if (!action) return json({ error: 'This action needs a connection. Your other offline changes are still saved.' }, 409);
  const data = await projected(active);
  if (!data) {
    if (live) return fetch(url, live);
    return json({ error: 'Open GroomPro online to prepare this device for offline work.' }, 409);
  }
  const target = action.target;
  const record = target && findRecord(data.snapshot, target.entity, target.id);
  const command: OfflineCommand = {
    ...active.scope, id: crypto.randomUUID(), url: url.pathname + url.search, method, body: raw,
    version: offlineRecordVersion(record), createdAt: Date.now(),
  };
  let result;
  try { result = projectOffline(data.snapshot, command); }
  catch (error) { if (live) return fetch(url, live); throw error; }
  if ('error' in result && result.error) return live ? fetch(url, live) : json(result, 409);
  const key = outboxKey(active.scope);
  await deviceUpdate<OfflineOutbox>(key, existing => {
    const queue = existing || emptyOutbox();
    const dependsOn = target && [...queue.pending].reverse().find(prior => {
      const route = new URL(prior.url, window.location.origin);
      const priorBody = JSON.parse(prior.body || '{}');
      const priorAction = offlineAction(route, prior.method, priorBody);
      if (priorAction?.target && offlineTargetKey(priorAction.target) === offlineTargetKey(target)) return true;
      if (target.entity === 'ticket' && (priorBody.draft?.draftId === target.id || route.pathname === '/api/tickets' && prior.method === 'POST' && priorBody.draftId === target.id)) return true;
      return target.id === 'offline-' + prior.id;
    });
    if (dependsOn) command.follows = dependsOn.id;
    if (live && !queue.pending.length) command.directUntil = Date.now() + 65000;
    return { ...queue, pending: [...queue.pending, command] };
  });
  if (command.directUntil) {
    let response: Response | undefined;
    try { response = await sendCommand(command, command.version, live); }
    catch { unreachableUntil = Date.now() + 15000; }
    if (response?.ok) {
      try {
        const receipt = await response.clone().json();
        await confirmCommand(key, command, receipt);
        change();
        const ticketId = receipt.ticket?.id || (target?.entity === 'ticket' ? target.id : null);
        if (ticketId) ticketSynced(active.scope, ticketId);
        return response;
      } catch { /* If the receipt is interrupted, retry the same command. */ }
    } else if (response && response.status < 500 && response.status !== 429) {
      await deviceUpdate<OfflineOutbox>(key, latest => latest && ({
        ...latest, pending: latest.pending.filter(entry => entry.id !== command.id),
      }));
      change();
      // This is a new online command rejected before any write, not an old
      // queued edit. Send it using the current authenticated session instead
      // of a stale device snapshot identity. Never reassign queued edits.
      if (response.status === 403 && (await response.clone().json().catch(()=>null))?.code === 'OFFLINE_SCOPE_MISMATCH') {
        await stopOfflineAccess();
        return fetch(url, live);
      }
      return response;
    }
    await deviceUpdate<OfflineOutbox>(key, latest => latest && ({
      ...latest, pending: latest.pending.map(entry => entry.id === command.id ? { ...entry, directUntil: undefined } : entry),
    }));
    change();
    return json({ ...result, offlinePending: true }, 202);
  }
  change();
  if (navigator.onLine) void syncOffline();
  return json({ ...result, offlinePending: true }, 202);
}

export async function deviceFetch(input: string, init?: RequestInit): Promise<Response> {
  if (typeof window === 'undefined') return fetch(input, init);
  const url = new URL(input, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return fetch(input, init);
  const method = (init?.method || 'GET').toUpperCase();
  const read = method === 'GET';
  const offline = !navigator.onLine || Date.now() < unreachableUntil;
  const active = offline || !read ? await activeDevice() : undefined;
  if (!read && (offline || active)) {
    const raw = typeof init?.body === 'string' ? init.body : '';
    if (active) {
      const queue = await deviceRead<OfflineOutbox>(outboxKey(active.scope)).catch(() => undefined);
      if (!offline && url.searchParams.get('locationId') && url.searchParams.get('locationId') !== active.scope.locationId) return fetch(input, init);
      if (!offline && queue?.pending.length) {
        // A saved outbox belongs to its original employee. Before appending a
        // new online edit, verify that another sign-in has not replaced them.
        try {
          const check=await fetch('/api/employee/session',{cache:'no-store'});
          const current=check.ok?(await check.json()).employee:undefined;
          if(check.status===401||check.ok&&(!current||current.id!==active.scope.employeeId)){
            await stopOfflineAccess();
            return fetch(input,init);
          }
        } catch { /* A valid prepared employee can still work while offline. */ }
      }
      const supported = !init?.body || typeof init.body === 'string';
      let allowed = false;
      try { allowed = supported && Boolean(offlineAction(url, method, JSON.parse(raw || '{}'))); } catch {}
      if (offline || allowed && queue?.pending.length) {
        if (!supported) return json({ error: 'This upload needs a connection.' }, 409);
        try { return await saveOnDevice(active, url, method, raw); }
        catch (error) { return json({ error: (error as Error).message || 'This device could not save the change.' }, 409); }
      }
      if (allowed && !offline) return saveOnDevice(active, url, method, raw, init || { method });
    } else if (offline) return json({ error: 'Sign in online to prepare this device for offline saves.' }, 409);
  }
  if (!read) return fetch(input, init);
  async function localRead() {
    const device = active || await activeDevice();
    const data = device && await projected(device);
    if (data) {
      try {
        if(url.pathname==='/api/reports'&&device){
          const history=await deviceRead<ReportHistory>(reportHistoryKey(device.scope));
          if(history&&same(history.scope,device.scope)){
            if(url.searchParams.has('locations')){
              const manifest=await deviceRead<any>('report-shops:'+offlineScopeKey(device.scope));
              if(url.searchParams.get('locations')==='compare'){
                if(!history.canManageTime||!manifest||manifest.accessKey!==history.accessKey)throw Error('Reconnect as an owner or manager to finish preparing shop comparisons.');
                const histories=await Promise.all(manifest.locations.map((l:any)=>deviceRead<ReportHistory>(reportHistoryKey({...device.scope,locationId:l.id}))));
                if(histories.some(h=>!h))throw Error('Reconnect to finish preparing each shop’s reporting history.');
                const pendingByShop:Record<string,any[]>={};for(const l of manifest.locations)pendingByShop[l.id]=pendingReportTickets(l.id===device.scope.locationId?data:await projected({...device,scope:{...device.scope,locationId:l.id}}));
                return json(offlineShopComparison(histories as ReportHistory[],url.searchParams.get('from')||'',url.searchParams.get('through')||'',pendingByShop));
              }
              if(history.canManageTime&&manifest?.accessKey===history.accessKey)return json({locations:manifest.locations,selected:device.scope.locationId});
            }
            const requested=url.searchParams.get('locationId');if(requested&&requested!==device.scope.locationId){
              const manifest=await deviceRead<any>('report-shops:'+offlineScopeKey(device.scope));
              if(!history.canManageTime||manifest?.accessKey!==history.accessKey||!manifest.locations.some((l:any)=>l.id===requested))throw Error('This shop’s reporting history is not prepared on this device.');
              const other=await deviceRead<ReportHistory>(reportHistoryKey({...device.scope,locationId:requested}));if(!other?.canManageTime)throw Error('Reconnect to refresh this shop’s reporting access.');return json(offlineReport(other,url.searchParams,pendingReportTickets(await projected({...device,scope:{...device.scope,locationId:requested}}))));
            }

            return json(offlineReport(history,url.searchParams,pendingReportTickets(data)));
          }
        }
        const value = offlineReadRecords(data.snapshot, url);
        if (value !== undefined) return json(value);
      } catch (error) { return json({ error: (error as Error).message }, 404); }
    }
    return json({ error: 'This information is not available on this device.' }, 503);
  }
  if (offline) return localRead();
  try {
    if (!url.pathname.startsWith('/api/employee/')) {
      const device = await activeDevice();
      const queue = device && await deviceRead<OfflineOutbox>(outboxKey(device.scope));
      if (queue?.pending.length && device) {
        const result = await localRead();
        if (result.ok) return result;
      }
    }
    const response = await fetch(input, init);
    if(response.ok&&url.pathname==='/api/reports'){
      const device=await activeDevice();const revision=identityRevision;
      if(device){const value=await response.clone().json();if(revision===identityRevision)await deviceUpdate<OfflineRecords>(snapshotKey(device.scope),state=>state&&({...state,lookups:{...state.lookups,[url.pathname+url.search]:{...value,offlineSavedAt:new Date().toISOString()}}})).catch(()=>{});}
    }
    if (response.status < 500 || init?.signal?.aborted) return response;
    const fallback = await localRead();
    return fallback.ok ? fallback : response;
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    unreachableUntil = Date.now() + 15000;
    return localRead();
  }
}

// A saved edit on another appointment can need staff review for hours.
function nextSyncCommand(pending: OfflineCommand[]) {
  const first = pending[0];
  if (!first?.issue) return first;
  const earlierTickets = new Set<string>();
  for (const command of pending) {
    const url = new URL(command.url, window.location.origin);
    const body = JSON.parse(command.body || '{}');
    const target = offlineAction(url, command.method, body)?.target;
    if (target?.entity !== 'ticket') return;
    const checkIn = url.pathname === '/api/pos-operation' && body.kind === 'STATUS'
      ? body.details?.status === 'CHECKED_IN' && !body.details.action
      : url.pathname === '/api/tickets/status' && body.status === 'CHECKED_IN' && !body.action;
    if (checkIn) {
      // Keep arrival order, same-ticket edits and offline record creation in sequence.
      if (command.issue || earlierTickets.has(target.id) || target.id.startsWith('offline-') ||
          pending.some(entry => entry.id === command.follows)) return;
      return command;
    }
    if (url.pathname === '/api/whiteboard' || url.pathname === '/api/tickets/status' ||
        url.pathname === '/api/pos-operation' || url.pathname === '/api/tickets' && ('arrivalPriority' in body || 'status' in body)) return;
    earlierTickets.add(target.id);
  }
}

export function syncOffline() {
  if (syncing) return syncing;
  const run = async () => {
    if (!navigator.onLine) return;
    const active = await activeDevice();
    if (!active) return;
    const key = outboxKey(active.scope);
    let completed = false;
    for (;;) {
      const queue = await deviceRead<OfflineOutbox>(key);
      const command = nextSyncCommand(queue?.pending || []);
      if (!command) break;
      if (command.issue || (command.directUntil || 0) > Date.now()) return;
      const session = await activeDevice();
      if (!session || !same(session.scope, active.scope)) return;
      const url = new URL(command.url, window.location.origin);
      const target = offlineAction(url, command.method, JSON.parse(command.body || '{}'))?.target;
      const prior = queue?.confirmed.find(entry => entry.command.id === command.follows);
      const version = target && prior?.result.offlineVersions?.[offlineTargetKey(target)] || command.version;
      const response = await sendCommand(command, version);
      unreachableUntil = 0;
      if (response.status >= 500 || response.status === 429) return;
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          await deviceUpdate<OfflineOutbox>(key, latest => latest && ({ ...latest, signInRequired: true }));
          change();
          return;
        }
        await deviceUpdate<OfflineOutbox>(key, latest => latest && ({
          ...latest, pending: latest.pending.map(entry => entry.id === command.id ? {
            ...entry, issue: result.error || 'Review this offline change.', cloud: result.cloud, warning: result.schedulingWarning, attendanceDecision:result.attendanceDecision, attendanceChoice:undefined,
          } : entry),
        }));
        change();
        continue;
      }
      await confirmCommand(key, command, result);
      completed = true;
      change();
      // Publish each saved ticket even when a later queued change needs review.
      // Readers apply remaining queued edits before showing the confirmed order.
      const ticketId = result.ticket?.id || (target?.entity === 'ticket' ? target.id : null);
      if (ticketId) ticketSynced(active.scope, ticketId);
    }
    if (completed) {
      await refreshDevice(active.scope);
      window.dispatchEvent(new CustomEvent('groompro:data-changed', { detail: { url: '/api/customers' } }));
      window.dispatchEvent(new CustomEvent('groompro:data-changed', { detail: { url: '/api/pets' } }));
      window.dispatchEvent(new CustomEvent('groompro:ticket-changed'));
    }
  };
  syncing = run().catch(() => {}).finally(() => { syncing = null; });
  return syncing;
}

export async function reviewOffline(id: string, resolution: 'retry' | 'device' | 'cloud' | 'warning' | 'attendance-send' | 'attendance-skip') {
  const active = await activeDevice();
  if (!active) return;
  const key = outboxKey(active.scope);
  const queue = await deviceRead<OfflineOutbox>(key);
  const command = queue?.pending.find(entry => entry.id === id);
  if (!command?.issue) return;
  await deviceUpdate<OfflineOutbox>(key, latest => latest && ({
    ...latest,
    ...(resolution === 'cloud' ? { archived: [...(latest.archived || []), command] } : {}),
    pending: latest.pending.flatMap(entry => {
      if (entry.id !== id) return [entry];
      if (resolution === 'cloud') return [];
      return [{
        ...entry, issue: undefined, cloud: undefined,
        ...(resolution === 'device' ? { version: offlineRecordVersion(entry.cloud), follows: undefined } : {}),
        ...(['attendance-send','attendance-skip'].includes(resolution)?{attendanceChoice:offlineAttendanceChoice(entry,resolution==='attendance-send'),attendanceDecision:undefined}:{}),
        ...(resolution === 'warning' && entry.warning ? { overrides: [...(entry.overrides || []), entry.warning] } : {}),
      }];
    }),
  }));
  change();
  void syncOffline();
}
