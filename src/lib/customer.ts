import {popupPetMemberships} from './popup-pet-memberships';
import {customerStates} from './appointment-customer-state';
import {attendingPets} from './appointment-pets';
import { db } from "./db";
import { customerReferrals } from './customer-referrals';
import {latestSinglePetServiceVisit} from './single-pet-booking';

import {normalizePhone} from './phone-normalization';
export {normalizePhone} from './phone-normalization';

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function searchCustomers(tenantId: string, query: string, limit: number | "all" = 25, includeReferrals = false) {
  const text = normalizeText(query);
  const phone = normalizePhone(query);

  const results=await db.customer.findMany({
    where: {
      tenantId,
      active: true,
      ...(text ? { OR: [
        { id: { equals: text } },
        { importSourceId: { contains: text } },
        ...(text.split(' ').length>1?[{AND:text.split(' ').filter(Boolean).map(word=>({OR:[{firstName:{contains:word}},{lastName:{contains:word}}]}))}]:[]),
        ...(phone.length >= 3 ? [{ phones: { some: { tenantId, normalized: { contains: phone } } } }] : []),
        { firstName: { contains: text } },
        { lastName: { contains: text } },
        { email: { contains: text } },
        { pets: { some: { name: { contains: text } } } },
      ] } : {}),
    },
    include: {
      phones: { orderBy: { isPrimary: "desc" } },
      tickets:{where:{scheduledStart:{gte:new Date()},status:{notIn:["CANCELLED","NO_SHOW","CLOSED"]}},orderBy:{scheduledStart:"asc"},take:1,select:{scheduledStart:true}},
      pets: { where: { active: true }, orderBy: { name: "asc" } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    take: limit === "all" ? undefined : limit,
  });
 const referrals=includeReferrals?await customerReferrals(tenantId,results.map(customer=>customer.id)):null;
 return results.map(({tickets,...customer})=>({...customer,...referrals?.get(customer.id),nextAppointment:tickets[0]?.scheduledStart||null}));
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
  const customer=await db.customer.findFirst({
    where: { id: customerId, tenantId, active: true },
    include: {
      phones: { orderBy: { isPrimary: "desc" } },
      pets: {

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
  if(!customer)return null;
  const activePets=customer.pets.filter(pet=>pet.active);
  const petId=activePets.length===1?activePets[0].id:null;
  const serviceLines=petId?{petId,lineType:'SERVICE' as const}:null;
  const olderVisits=customer.tickets.length===20&&serviceLines&&!latestSinglePetServiceVisit(serviceLines.petId,customer.tickets)
    ?db.ticket.findMany({where:{tenantId,customerId,status:'CLOSED',lines:{some:serviceLines}},select:{status:true,scheduledStart:true,closedAt:true,createdAt:true,lines:{where:serviceLines,select:{petId:true,lineType:true,serviceId:true,packageId:true,packageName:true,description:true,quantity:true,role:true,sortOrder:true,service:{select:{name:true,code:true,customFields:true}}}}}})
    :Promise.resolve([]);
  const [referrals,memberships,visits]=await Promise.all([customerReferrals(tenantId,[customerId]),popupPetMemberships(db,tenantId,{customerId,pets:customer.pets.map(pet=>({pet}))}),olderVisits]);
  const lastServiceVisit=petId&&visits.length?latestSinglePetServiceVisit(petId,visits):undefined;
  return {...customer,pets:memberships.pets.map((entry:any)=>entry.pet),...referrals.get(customerId),tickets:await customerStates(tenantId,customer.tickets.map(attendingPets)),lastServiceVisit};
}
