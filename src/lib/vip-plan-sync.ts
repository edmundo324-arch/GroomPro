export function vipSyncChoices(input:any){
 for(const key of ['updateVipBenefits','updateVipPrice'])if(input[key]!==undefined&&typeof input[key]!=='boolean')throw Error('Choose separately whether to update members’ included services and future price.');
 return {updateVipBenefits:input.updateVipBenefits===true,updateVipPrice:input.updateVipPrice===true};
}

// A plan's included services and agreed recurring price are separate snapshots.
// Preserve the original enrollment terms for historical commission attribution;
// never rewrite signed agreements, processed charges or the $1 activation fee.
export async function syncVipPlanMembers(tx:any,tenantId:string,actorId:string,planId:string,before:any,after:any,choices:ReturnType<typeof vipSyncChoices>,now=new Date()){
 const result={vipBenefitsUpdated:0,vipPricesUpdated:0,vipScheduledChargesUpdated:0,vipChargesForReview:0};
 if(!choices.updateVipBenefits&&!choices.updateVipPrice)return result;
 const snapshots=await tx.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'MEMBERSHIP_PLAN:'}},orderBy:{settingKey:'asc'}});
 for(const row of snapshots){
  if(row.value?.planId!==planId)continue;
  const membershipId=row.settingKey.slice('MEMBERSHIP_PLAN:'.length);
  const [member]=await tx.$queryRaw`SELECT * FROM Membership WHERE id=${membershipId} AND tenantId=${tenantId} FOR UPDATE`;
  if(!member||!['ACTIVE','PAUSED','PAUSE_REQUESTED','CANCELLATION_REQUESTED'].includes(member.status))continue;
  const current=(await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:row.settingKey}}}))?.value;
  if(!current||current.planId!==planId)continue;
  const benefitsChanged=choices.updateVipBenefits&&(JSON.stringify(current.items)!==JSON.stringify(after.items)||(current.description||'')!==(after.description||''));
  const priceChanged=choices.updateVipPrice&&(member.recurringPriceCents!==after.priceCents||current.priceCents!==after.priceCents);
  const rename=current.name===before.name&&current.name!==after.name;
  if(!benefitsChanged&&!priceChanged&&!rename)continue;
  const originalKey='MEMBERSHIP_ENROLLMENT_PLAN:'+membershipId;
  if(!await tx.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:originalKey}}}))await tx.tenantSetting.create({data:{tenantId,settingKey:originalKey,value:current}});
  const value={...current,...(benefitsChanged?{items:after.items,description:after.description}:{}),...(priceChanged?{priceCents:after.priceCents}:{}),...(rename?{name:after.name}:{})};
  await tx.tenantSetting.update({where:{tenantId_settingKey:{tenantId,settingKey:row.settingKey}},data:{value}});
  let scheduledChargesUpdated=0,chargesForReview=0;
  if(priceChanged){
   const charges=await tx.$queryRaw`SELECT id,amountCents,taxCents FROM MembershipPayment WHERE tenantId=${tenantId} AND membershipId=${membershipId} AND status='PENDING' AND processedAt IS NULL AND scheduledFor>${now} AND paymentType<>'START_VIP' FOR UPDATE`;
   for(const charge of charges){
    if(charge.amountCents!==member.recurringPriceCents||charge.taxCents!==0){chargesForReview++;continue;}
    scheduledChargesUpdated+=Number(await tx.$executeRaw`UPDATE MembershipPayment SET amountCents=${after.priceCents} WHERE id=${charge.id} AND tenantId=${tenantId} AND membershipId=${membershipId} AND status='PENDING' AND processedAt IS NULL AND scheduledFor>${now}`);
   }
   await tx.$executeRaw`UPDATE Membership SET recurringPriceCents=${after.priceCents},updatedAt=NOW(3) WHERE id=${membershipId} AND tenantId=${tenantId}`;
   result.vipPricesUpdated++;
  }
  if(rename&&member.name===before.name)await tx.$executeRaw`UPDATE Membership SET name=${after.name},updatedAt=NOW(3) WHERE id=${membershipId} AND tenantId=${tenantId}`;
  if(benefitsChanged)result.vipBenefitsUpdated++;
  result.vipScheduledChargesUpdated+=scheduledChargesUpdated;result.vipChargesForReview+=chargesForReview;
  await tx.auditEntry.create({data:{tenantId,actorType:'EMPLOYEE',actorUserId:actorId,entityType:'MEMBERSHIP',entityId:membershipId,customerId:member.customerId,action:'VIP_PLAN_SYNC',summary:'Updated selected membership terms; historical charges and signed agreements were retained.',details:{planId,benefitsChanged,priceChanged,previousPriceCents:member.recurringPriceCents,newPriceCents:priceChanged?after.priceCents:member.recurringPriceCents,previousItems:current.items,items:value.items,scheduledChargesUpdated,chargesForReview}}});
 }
 return result;
}
