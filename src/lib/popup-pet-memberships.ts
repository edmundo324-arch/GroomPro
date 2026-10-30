// Query only when VIP is selected, and scope membership status to each pet.
export async function popupPetMemberships(client:any,tenantId:string,ticket:any){
 const memberships=await client.$queryRaw`SELECT petId FROM Membership WHERE tenantId=${tenantId} AND customerId=${ticket.customerId||ticket.customer?.id} AND status IN ('ACTIVE','PAUSED','PAUSE_REQUESTED','CANCELLATION_REQUESTED')`;
 return {...ticket,pets:ticket.pets.map((entry:any)=>({...entry,pet:{...entry.pet,vipMember:memberships.some((membership:any)=>membership.petId===entry.pet.id)}}))};
}
