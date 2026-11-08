import { bookedPetIds } from './appointment-pets';
import { expandPackage } from './package-lines';
import { lineSchedule, movePetTimes, responsibleEmployee, scheduleBounds } from './pet-scheduling';
import { ticketDuration } from './ticket-timing';
import { localToInstant, defaultHours, parseHours } from './operating-hours';
import { removePackageLine } from './package-removal';
import { plannedKey } from './planned-package-rules';
import { initialGroomingInstructions } from './grooming-note-defaults';
import { notesDeadline } from './grooming-notes-rules';
import { buildHoverDetails } from './calendar-hover-details';
import { reportCardText } from './report-card';
import { offlineAction, offlineRecordId, type OfflineCommand } from './offline-actions';
import type { OfflineSnapshot } from './offline-device-store';

export type OfflineRecords = OfflineSnapshot & { lookups: Record<string, any> };
export function findRecord(state: OfflineRecords, entity: string, id: string) {
  if (entity === 'customer') return state.customers.find(row => row.id === id);
  if (entity === 'pet') return state.customers.flatMap(row => row.pets).find(row => row.id === id);
  return (entity === 'ticket' ? state.tickets : state.drafts).find(row => row.id === id);
}

function replace(rows: any[], value: any) {
  const index = rows.findIndex(row => row.id === value.id);
  if (index === -1) rows.push(value);
  else rows[index] = { ...rows[index], ...value };
}

function customerRecord(state: OfflineRecords, id: string) {
  const customer = findRecord(state, 'customer', id);
  if (!customer) throw Error('This customer is outside the records available on this device.');
  return customer;
}

function phoneRows(body: any, id: string) {
  const phones = body.phones || (body.phone ? [{ number: body.phone, isPrimary: true }] : []);
  return phones.filter((phone: any) => phone.number?.trim()).map((phone: any, index: number) => ({ ...phone, id: phone.id || id + '-phone-' + index }));
}

function catalogLines(state: OfflineRecords, body: any, id: string, startOrder = 0): any[] {
  const { packages = [], services = [], products = [] } = state.lookups['/api/catalog'] || {};
  const values = body.lines?.length ? body.lines : [body];
  const result: any[] = [];
  for (const input of values) {
    const kind = input.type || 'SERVICE';
    const item = (kind === 'PACKAGE' ? packages : kind === 'PRODUCT' ? products : services).find((row: any) => row.id === input.id);
    if (!item) throw Error('This service, package, or product has not been saved to this device.');
    const packageItems = kind === 'PACKAGE'
      ? expandPackage(item, services, input.petId).map((part: any) => ({ ...part, service: services.find((service: any) => service.id === part.serviceId) }))
      : [{ service: item, quantity: 1, unitPriceCents: Number(item.priceCents ?? item.finalPriceCents ?? item.basePriceCents ?? 0), discountCents: 0, totalCents: Number(item.priceCents ?? item.finalPriceCents ?? item.basePriceCents ?? 0) }];
    for (const part of packageItems) {
      const service = part.service;
      const quantity = (part.quantity || 1) * (input.quantity || 1);
      const pet = input.petId && findRecord(state, 'pet', input.petId);
      const unitPriceCents = part.unitPriceCents;
      const position = startOrder + result.length;
      result.push({
        id: id + '-line-' + result.length, sortOrder: position, lineType: kind === 'PRODUCT' ? 'PRODUCT' : 'SERVICE',
        petId: input.petId || null, pet: pet || null, serviceId: kind === 'PRODUCT' ? null : service.id,
        productId: kind === 'PRODUCT' ? item.id : null, service: kind === 'PRODUCT' ? null : service,
        description: kind === 'PACKAGE' ? item.name + ' · ' + service.name : service.name,
        ...(kind === 'PACKAGE' ? { packageId: item.id, packageName: item.name, packageGroupKey: input.petId + ':' + item.id } : {}),
        role: input.role || ('role' in part && part.role) || service.workflowRole || (kind === 'PRODUCT' ? 'PRODUCT' : 'ADD_ON'),
        durationMin: input.durationMin ?? service.durationMin ?? 0,
        quantity, unitPriceCents, totalCents: part.totalCents * (input.quantity || 1), discountCents: part.discountCents * (input.quantity || 1),
        assignedUserId: input.assignedUserId || null, offerToday: Boolean(input.offerToday),
      });
    }
  }
  return result;
}

function ticketSummary(state: OfflineRecords, ticket: any) {
  ticket.pets = bookedPetIds(ticket.lines).map(petId => ({ petId, pet: findRecord(state, 'pet', petId) }))
    .filter(entry => entry.pet);
  ticket.durationMin = ticketDuration(ticket.lines, ticket.timingMode);
  ticket.totalCents = ticket.lines.reduce((total: number, line: any) => total + (line.totalCents || 0), 0) +
    (ticket.salesTaxCents || 0) + (ticket.tipCents || 0);
  return ticket;
}

function noteDefaults(state: OfflineRecords, pet: any, before = Date.now(), ticketId?: string) {
  const history = state.notes.filter(note => note.petId === pet.id && note.ticketId !== ticketId &&
    note.appointmentAt && +new Date(note.appointmentAt) < before)
    .filter(note => state.tickets.some(ticket => ticket.id === note.ticketId && !['CANCELLED', 'NO_SHOW'].includes(ticket.status)))
    .sort((a, b) => +new Date(b.appointmentAt) - +new Date(a.appointmentAt));
  const usual = history.filter(note => note.usual).sort((a, b) => +new Date(b.usualAt) - +new Date(a.usualAt))[0];
  const value = initialGroomingInstructions(pet, usual?.instructions, history[0]?.instructions, state.lookups['/api/breeds']?.breeds);
  if (!history.length && pet.groomingNotes) value.specialNotes = pet.groomingNotes;
  return value;
}

function bookingNotes(state: OfflineRecords, ticket: any, now: string) {
  for (const { petId, pet } of ticket.pets) {
    if (state.notes.some(note => note.ticketId === ticket.id && note.petId === petId)) continue;
    const entered = ticket.groomingNotesDraft?.[petId];
    state.notes.push({
      id: ticket.id + '-note-' + petId, customerId: ticket.customerId, ticketId: ticket.id, petId,
      appointmentAt: ticket.scheduledStart || null, createdAt: now, revision: 0,
      instructions: entered?.instructions || noteDefaults(state, pet, ticket.scheduledStart ? +new Date(ticket.scheduledStart) : Date.now(), ticket.id),
      usual: entered?.usual || false, usualAt: entered?.usual ? now : null,
    });
  }
}

export function projectOffline(state: OfflineRecords, command: OfflineCommand) {
  const url = new URL(command.url, 'https://groompro.local');
  const path = url.pathname;
  const body = JSON.parse(command.body || '{}');
  const action = offlineAction(url, command.method, body);
  const id = offlineRecordId(command.id);
  const now = new Date(command.createdAt).toISOString();
  if (!action) throw Error('This action requires a connection.');
  if (action.create === 'customer' || action.target?.entity === 'customer' && path !== '/api/grooming-notes') {
    if (!body.firstName?.trim() || !body.lastName?.trim()) throw Error('First and last name are required.');
    const old = action.target && customerRecord(state, action.target.id);
    const customerId = old?.id || id;
    const customer = {
      active: true, pets: [], communications: [], createdAt: now, ...old, ...body, id: customerId,
      phones: body.phones || body.phone ? phoneRows(body, customerId) : old?.phones || [],
    };
    replace(state.customers, customer);
    return { customer };
  }
  if (path === '/api/pets') {
    if (!body.name?.trim()) throw Error('Pet name is required.');
    const customer = customerRecord(state, body.customerId);
    const old = action.target && findRecord(state, 'pet', action.target.id);
    if (action.target && (!old || old.customerId !== customer.id)) throw Error('Pet not found for this customer.');
    const pet = { active: true, vaccinations: [], createdAt: now, ...old, ...body, id: old?.id || id };
    replace(customer.pets, pet);
    return { pet };
  }
  if (path === '/api/pos-drafts') {
    if (action.create) {
      const draft = { id, requestKey: body.requestKey, orderNumber: null, createdAt: now,
        payload: { ticket: { timingMode: state.lookups['/api/workflow-settings']?.settings?.timingMode || 'SEQUENTIAL' } } };
      replace(state.drafts, draft);
      return { draft };
    }
    const draft = findRecord(state, 'draft', body.id);
    if (!draft) throw Error('Ticket draft is missing from this device.');
    replace(state.drafts, { ...draft, payload: body.payload });
    return { saved: true };
  }
  if (path === '/api/grooming-notes') {
    if (body.permanent) {
      const record = findRecord(state, action.target!.entity, action.target!.id);
      if (!record) throw Error('Notes are missing from this device.');
      record[body.permanent === 'LEGACY' ? 'groomingNotes' : 'notes'] = body.value;
      return { ok: true };
    }
    const record = state.notes.find(note => note.id === body.id);
    const location = state.lookups['/api/operating-hours'];
    const deadline = record?.appointmentAt && notesDeadline(new Date(record.appointmentAt),
      location?.hours ? parseHours(location.hours) : defaultHours(), state.location.timezone, location?.specialHours || []);
    if (!record || record.lockedAt || deadline && +deadline <= Date.now()) throw Error('These grooming notes are locked or unavailable.');
    const source = body.sourceId && state.notes.find(note => note.id === body.sourceId);
    Object.assign(record, { instructions: source?.instructions || body.instructions, usual: body.usual ?? record.usual, revision: record.revision + 1 });
    return { record };
  }
  const draft = path === '/api/pos-operation' ? body.draft : path === '/api/tickets' && command.method === 'POST' ? body : null;
  if (draft) {
    const customer = customerRecord(state, draft.customerId);
    const original = draft.draftId && findRecord(state, 'draft', draft.draftId);
    const ticketId = draft.draftId || id;
    const sourceLines = draft.lines?.every((line: any) => line.description && Number.isFinite(line.totalCents)) ? draft.lines : original?.payload?.ticket?.lines;
    const lines = sourceLines?.length
      ? sourceLines.map((line: any, position: number) => ({ ...line, lineType: line.lineType || line.type, id: id + '-line-' + position, sortOrder: position }))
      : catalogLines(state, draft, id);
    if (!lines.length) throw Error('Add at least one service or product.');
    const ticket = ticketSummary(state, {
      ...draft, id: ticketId, locationId: state.scope.locationId, customer, lines,
      orderNumber: original?.orderNumber || null, status: 'OPEN', bookingDecision: 'INTERNAL', createdAt: original?.createdAt || now,
      lineStarts: Object.fromEntries((draft.lineStartPositions || []).filter((entry: any) => lines[entry.sortOrder]).map((entry: any) => [lines[entry.sortOrder].id, entry.start])),
      payments: [], assignments: [], scheduleHistory: [],
    });
    replace(state.tickets, ticket);
    bookingNotes(state, ticket, now);
    state.drafts = state.drafts.filter(row => row.id !== ticketId);
    return { ticket, savedTicketId: ticketId };
  }
  const ticket = action.target && findRecord(state, 'ticket', action.target.id);
  if (!ticket) throw Error('This appointment is outside the records available on this device.');
  if (path === '/api/pos-operation' && body.kind === 'SAVE') return { ticket, savedTicketId: ticket.id };
  const details = path === '/api/pos-operation' ? body.details || {} : body;
  if (path === '/api/tickets/rebook' || body.kind === 'REBOOK') {
    const rebooked = { ...ticket, id, createdAt: now, orderNumber: null, scheduledStart: details.scheduledStart,
      status: 'OPEN', bookingDecision: 'INTERNAL', checkedInAt: null, pickupAt: null, pickupCompletedAt: null,
      pickupCalledAt: null, pickupTextedAt: null, readyContacted: false,
      arrivalPriority: null, payments: [], lineStarts: {}, scheduleHistory: [],
      lines: ticket.lines.filter((line: any) => line.lineType === 'SERVICE' && line.serviceId)
        .sort((a: any,b: any)=>a.sortOrder-b.sortOrder).map((line: any, position: number) => ({ ...line, assignedUserId: null, assignedUser: null, id: id + '-line-' + position })) };
    ticketSummary(state, rebooked);
    replace(state.tickets, rebooked);
    bookingNotes(state, rebooked, now);
    return { ticket: rebooked };
  }
  if (path === '/api/tickets/status' || body.kind === 'STATUS') {
    if (details.status) ticket.status = details.status;
    if (details.action === 'UNDO_CHECK_IN') Object.assign(ticket, { status: 'CONFIRMED', checkedInAt: null, arrivalPriority: null, pickupAt: null });
    if (details.action === 'UNDO_READY') Object.assign(ticket, { status: ticket.checkedInAt ? 'CHECKED_IN' : 'CONFIRMED', pickupAt: null });
    if (details.status === 'CHECKED_IN') ticket.checkedInAt ||= now;
    if (details.status === 'READY'||details.status === 'READY_FOR_PICKUP') ticket.pickupAt ||= now;
    if (!ticket.pickupAt) Object.assign(ticket, {pickupCalledAt:null,pickupTextedAt:null,readyContacted:false});
    if (details.status === 'OPEN' || details.checkedIn === false) Object.assign(ticket, { checkedInAt: null, arrivalPriority: null });
  } else if (path === '/api/tickets/visit-history') {
    if(ticket.status!=='READY'||!ticket.pickupAt||ticket.pickupCompletedAt)throw Error('Mark the ticket ready for pickup before recording a call.');
    ticket.pickupCalledAt ||= now;
    return {pickupCalledAt:ticket.pickupCalledAt};
  } else if (path === '/api/ticket-lines') {
    const lineId = body.lineId || url.searchParams.get('lineId');
    if (command.method === 'DELETE') {
      const remove = body.lineIds || [lineId];
      const line = ticket.lines.find((entry: any) => entry.id === lineId);
      const choice = body.packageRemovalChoice || state.lookups['/api/workflow-settings']?.settings?.posLayout?.packageRemovalChoice;
      if (line?.packageId && choice !== 'KEEP_DISCOUNT' && choice !== 'REMOVE_DISCOUNT') return { packageRemovalRequired: true, error: 'Choose how to price the remaining package services.' };
      if (line?.packageId) {
        const prices = Object.fromEntries((state.lookups['/api/catalog']?.services || []).map((service: any) => [service.id, service.priceCents ?? service.finalPriceCents]));
        ticket.lines = removePackageLine(ticket.lines, line, choice, prices);
      } else ticket.lines = ticket.lines.filter((entry: any) => !remove.includes(entry.id));
      ticketSummary(state, ticket);
      return { removed: true, lineId, removedLineIds: remove, durationMin: ticket.durationMin };
    }
    if (command.method === 'PATCH') {
      const line = ticket.lines.find((value: any) => value.id === lineId);
      if (!line) throw Error('This line is missing from the device.');
      Object.assign(line, body);
      line.totalCents = Math.max(0, line.quantity * line.unitPriceCents - line.discountCents);
      ticketSummary(state, ticket);
      return { line };
    }
    const catalog = body.id || body.serviceId || body.productId || body.packageId;
    const existing = ticket.lines.filter((line: any) => line.petId === body.petId && line.serviceId === catalog && line.offerToday);
    const lines = body.offerToday && !body.present && existing.length ? [] : catalogLines(state, { ...body, id: catalog }, id, ticket.lines.length);
    ticket.lines = [...ticket.lines.filter((line: any) => !existing.includes(line)), ...lines];
    ticketSummary(state, ticket);
    bookingNotes(state, ticket, now);
    return { ticket, lines, removedLineIds: existing.map((line: any) => line.id) };
  } else if (path === '/api/tickets/package') {
    const removed = ticket.lines.filter((line: any) => line.petId === body.petId && line.packageId === body.packageId);
    if (Boolean(removed.length) === body.present) return { changed: false };
    const lines = !body.present ? [] : catalogLines(state, { ...body, type: 'PACKAGE', id: body.packageId }, id, ticket.lines.length);
    ticket.lines = [...ticket.lines.filter((line: any) => !removed.includes(line)), ...lines];
    ticketSummary(state, ticket);
    bookingNotes(state, ticket, now);
    return { ticket, lines, removedLineIds: removed.map((line: any) => line.id), durationMin: ticket.durationMin };
  } else if (path === '/api/tickets/customer') {
    ticket.customer = customerRecord(state, body.customerId);
    ticket.customerId = body.customerId;
  } else if (path === '/api/tickets/pets') {
    const pet = findRecord(state, 'pet', body.petId);
    if (!pet || pet.customerId !== ticket.customerId || !pet.active) throw Error('Choose an active dog belonging to this customer.');
    if (!body.included && ticket.lines.some((line: any) => line.petId === pet.id)) throw Error('Remove this dog’s service lines first.');
    ticket.pets = ticket.pets.filter((entry: any) => entry.petId !== pet.id);
    if (body.included) ticket.pets.push({ petId: pet.id, pet });
    bookingNotes(state, ticket, now);
    return { ok: true };
  } else if (path === '/api/tickets/daycare') {
    const service = state.lookups['/api/catalog']?.services?.find((entry: any) => entry.active && (entry.category === 'DAYCARE' || entry.name === 'Daycare'));
    if (!service) throw Error('A Daycare service must be configured first.');
    const isDaycare = (line: any) => line.serviceId === service.id && line.role === 'ADD_ON' && !line.petId;
    if (body.staying && !ticket.lines.some(isDaycare)) ticket.lines.push(...catalogLines(state, { id: service.id, type: 'SERVICE', role: 'ADD_ON' }, id, 999999));
    if (!body.staying) ticket.lines = ticket.lines.filter((line: any) => !isDaycare(line));
    ticket.daycareStatus = body.staying ? 'STAYING' : 'NONE';
    ticketSummary(state, ticket);
    return { ticket, daycareStatus: ticket.daycareStatus, affectsAllDogsOnTicket: true };
  } else if (path === '/api/tickets/line-times') {
    ticket.lineStarts = { ...lineSchedule(ticket), [body.lineId]: body.scheduledStart };
    Object.assign(ticket, scheduleBounds(ticket, lineSchedule(ticket)));
  } else if (path === '/api/calendar/move-pet') {
    if (responsibleEmployee(ticket.lines, body.petId)) throw Error('Change this dog’s actual employee in the POS Ticket or Whiteboard.');
    ticket.lineStarts = movePetTimes(ticket, body.petId, new Date(body.scheduledStart));
    Object.assign(ticket, scheduleBounds(ticket, ticket.lineStarts));
    if (body.employeeId !== undefined) {
      const previous = ticket.plannedAssignments || [];
      ticket.plannedAssignments = [...previous.filter((plan: any) => plan.petId !== body.petId), { petId: body.petId, userId: body.employeeId },
        ...previous.filter((plan: any) => plan.petId === body.petId && plan.packageKey).map((plan: any) => ({ ...plan, userId: body.employeeId }))];
    }
  } else if (path === '/api/whiteboard') ticket.arrivalPriority = body.value;
  else if (path === '/api/tickets/presentation') ticket.presentationServiceType = body.serviceType;
  else if (path === '/api/tickets/planned-packages') {
    const next = body.assignment;
    if (!next?.petId) throw Error('Choose a dog and employee.');
    const items = [...(ticket.plannedAssignments || []).filter((plan: any) => next.packageKey ? plannedKey(plan) !== plannedKey(next) : plan.petId !== next.petId), next];
    ticket.plannedAssignments = items;
    return { items };
  }
  else Object.assign(ticket, body);
  return { ticket, savedTicketId: ticket.id, lineStarts: ticket.lineStarts, plannedAssignments: ticket.plannedAssignments, moved: path === '/api/tickets', durationMin: ticket.durationMin };
}

export function offlineReadRecords(state: OfflineRecords, url: URL) {
  const { pathname: path, searchParams: params } = url;
  const customerId = params.get('customerId');
  const ticketId = params.get('ticketId');
  const q = (params.get('q') || '').trim().toLowerCase();
  if (path === '/api/customers/search' || path === '/api/customers/list') {
    const customers = state.customers.filter(customer => customer.active && (!q ||
      [customer.firstName + ' ' + customer.lastName, customer.lastName + ' ' + customer.firstName, customer.email, customer.id,
        ...customer.phones.map((phone: any) => phone.number), ...customer.pets.map((pet: any) => pet.name)]
        .some(value => String(value || '').toLowerCase().includes(q))));
    customers.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    const limit = params.get('limit');
    return { customers: limit === 'all' ? customers : customers.slice(0, Number(limit) || 25) };
  }
  const customerMatch = /^\/api\/customers\/([^/]+)$/.exec(path);
  if (customerMatch && !['account', 'rewards', 'location-access', 'payment-methods'].includes(customerMatch[1])) {
    const customer = customerRecord(state, customerMatch[1]);
    return { customer: { ...customer, tickets: state.tickets.filter(ticket => ticket.customerId === customer.id) } };
  }
  if (path === '/api/pets') {
    const pets = state.customers.filter(customer => customer.active)
      .flatMap(customer => customer.pets.map((pet: any) => ({ ...pet, customer })))
      .filter(pet => (pet.active || params.get('showInactive') === 'true') &&
        (!q || [pet.name, pet.breed, pet.customer.firstName, pet.customer.lastName].some(value => String(value || '').toLowerCase().includes(q))))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const limit = params.get('limit');
    return { pets: limit === 'all' ? pets : pets.slice(0, Number(limit) || 100) };
  }
  const ticketMatch = /^\/api\/tickets\/([^/]+)$/.exec(path);
  if (ticketMatch) {
    const ticket = findRecord(state, 'ticket', ticketMatch[1]);
    if (ticket) return { ticket: { ...ticket, customer: customerRecord(state, ticket.customerId), location: state.location }, account: customerRecord(state, ticket.customerId), paymentMethods: [], rewards: [] };
  }
  if (path === '/api/calendar' || path === '/api/tickets/list') {
    const start = params.get('start') || params.get('from');
    const end = params.get('end') || params.get('through');
    const timezone = state.location.timezone;
    const bound = (value: string | null, through = false) => {
      if (value?.length !== 10) return value ? +new Date(value) : 0;
      if (!through) return +localToInstant(value + 'T00:00', timezone);
      const next = new Date(value + 'T12:00:00Z');
      next.setUTCDate(next.getUTCDate() + 1);
      return +localToInstant(next.toISOString().slice(0, 10) + 'T00:00', timezone);
    };
    const low = bound(start);
    const high = end ? bound(end, path === '/api/tickets/list') : Infinity;
    const inRange = (value: string) => +new Date(value) >= low && +new Date(value) < high;
    const tickets = state.tickets.filter(ticket => ticket.locationId === state.scope.locationId &&
      (ticketId ? ticket.id === ticketId : path === '/api/calendar'
        ? Boolean(ticket.scheduledStart && (inRange(ticket.scheduledStart) || Object.values(ticket.lineStarts || {}).some(value => inRange(String(value)))))
        : inRange(ticket.scheduledStart || ticket.createdAt)) &&
      (params.get('requests') !== '1' || ['REQUESTED', 'PENDING'].includes(ticket.bookingDecision)))
      .map(ticket => ({ ...ticket, customer: customerRecord(state, ticket.customerId) }));
    if (path === '/api/calendar') return { ...state.lookups['/api/calendar'], locationId: state.scope.locationId, tickets };
    return { tickets: [...tickets, ...(params.get('requests') === '1' ? [] : state.drafts.map(draft => ({ ...draft.payload?.ticket, id: draft.id, orderNumber: draft.orderNumber, status: 'DRAFT' })))] };
  }
  if (path === '/api/pos-drafts') return { drafts: state.drafts.filter(draft => !params.get('id') || draft.id === params.get('id')) };
  if (path === '/api/calendar/details') {
    const ticket = findRecord(state, 'ticket', params.get('id') || '');
    const fields = state.lookups['/api/workflow-settings']?.settings?.hoverFields || ['time', 'pet', 'package', 'notes', 'customer'];
    if (ticket) return { details: buildHoverDetails({ ...ticket, customer: customerRecord(state, ticket.customerId) }, fields) };
  }
  if (path === '/api/tickets/report-card') {
    const ticket = findRecord(state, 'ticket', ticketId || '');
    if (ticket) return { body: reportCardText(ticket), phones: customerRecord(state, ticket.customerId).phones, configured: false };
  }
  if (path === '/api/ticket-lines') {
    const ticket = findRecord(state, 'ticket', ticketId || '');
    if (ticket) return { lines: ticket.lines };
  }
  if (path === '/api/tickets/upcoming') return { tickets: state.tickets.filter(ticket => ticket.customerId === customerId && +new Date(ticket.scheduledStart) >= Date.now()) };
  if (path === '/api/tickets/checkout') {
    const ticket = findRecord(state, 'ticket', ticketId || '');
    if (ticket) {
      const paidCents = ticket.payments.reduce((total: number, payment: any) => total + Math.round(Number(payment.amount || 0) * 100), 0);
      const subtotalCents = ticket.lines.reduce((total: number, line: any) => total + Number(line.totalCents || 0), 0);
      return { ticket, paidCents, subtotalCents, totalCents: ticket.totalCents, dueCents: Math.max(0, ticket.totalCents - paidCents), account: customerRecord(state, ticket.customerId) };
    }
  }
  if (path === '/api/customers/account') {
    const customer = customerRecord(state, customerId || '');
    return { customer, account: customer };
  }
  if (path === '/api/customers/rewards') return { rewards: [] };
  if (path === '/api/grooming-notes') {
    const customer = customerRecord(state, customerId || '');
    const records = state.notes.filter(note => note.customerId === customerId).map(note => {
      const ticket = findRecord(state, 'ticket', note.ticketId);
      return { ...note, status: ticket?.status, orderNumber: ticket?.orderNumber };
    }).sort((a, b) => +new Date(b.appointmentAt) - +new Date(a.appointmentAt));
    return { customer, pets: customer.pets, records,
      defaults: Object.fromEntries(customer.pets.map((pet: any) => [pet.id, noteDefaults(state, pet, Date.now(), ticketId || undefined)])) };
  }
  return state.lookups[url.pathname + url.search] ?? state.lookups[path];
}
