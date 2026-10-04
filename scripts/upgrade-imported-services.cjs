const {randomUUID}=require('node:crypto');
const descriptions={
 '1111':'My spa day started at my pace, with time to get comfortable with my surroundings and the team caring for me. Once I was settled in, my coat was gently brushed out, my ears were freshened up, and my nails were cared for. Then I had some time to relax and recharge before heading to the bathtub.',
 'Silvet-Shampoo':'My skin needed a little extra attention today, so after my initial bath, I received an 8-minute Silvet treatment. Its antifungal, antimicrobial, and cortisone formula helped soothe irritation and support healthier, more comfortable skin.',
 '2222':'Feeling comfortable and ready, it was time to get squeaky clean! I was thoroughly washed until the water rinsed clear, helping leave my skin and coat fresh and clean. After a cozy towel dry, I received one-on-one attention while my coat was gently blown out and fluffed. Then I had another chance to relax and recharge before my finishing groom.',
 '2220':'Feeling comfortable and ready, it was time to get squeaky clean! I was thoroughly washed until the water rinsed clear, helping leave my skin and coat fresh and clean.\nI let the team know I preferred a gentler drying experience today, so they followed my lead with extra towel drying and kept my comfort at the center of my spa day.'
};
const names={'1111':'Prepared Before Bath','2222':'Bath after Prep and rest','2220':'No Dryer, Bath after Prep and Rest'};
function correction(row){
 const marker=String(row.description||'').match(/^DaySmart service ID:\s*(.+)$/i);
 const code=row.code||marker?.[1]?.trim()||(Object.hasOwn(names,row.name)?row.name:null);
 if(!code)return null;
 const update={};if(!row.code)update.code=code;
 if(Object.hasOwn(names,code)&&row.name===code)update.name=names[code];
 // Only the four descriptions explicitly supplied by the owner are candidates.
 // Preserve every other valid report-card description and store originals first.
 if(descriptions[code]&&(marker||row.name===code||(!row.description&&code==='Silvet-Shampoo')))update.description=descriptions[code];
 return Object.keys(update).length?update:null;
}
async function upgradeImportedServices(db){
 let changed=0;
 await db.$transaction(async tx=>{
  const rows=await tx.$queryRaw`SELECT s.id,s.tenantId,s.name,s.code,s.description FROM Service s INNER JOIN Tenant t ON t.id=s.tenantId WHERE t.name='Rubber Doggies Grooming'`;
  for(const row of rows){const update=correction(row);if(!update)continue;
   const existing=await tx.importRecord.findUnique({where:{tenantId_source_entityType_sourceId:{tenantId:row.tenantId,source:'groompro-service-upgrade-v1',entityType:'SERVICE',sourceId:row.id}}});if(existing)continue;
   if(update.code&&await tx.service.findFirst({where:{tenantId:row.tenantId,code:update.code,id:{not:row.id}}}))continue;
   await tx.importRecord.create({data:{id:randomUUID(),tenantId:row.tenantId,source:'groompro-service-upgrade-v1',entityType:'SERVICE',sourceId:row.id,targetId:row.id,payload:{name:row.name,code:row.code,description:row.description}}});
   await tx.service.update({where:{id:row.id},data:update});changed++;
  }
 });return changed;
}
module.exports={correction,upgradeImportedServices};
