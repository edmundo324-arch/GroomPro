// Recover only untouched preview appointments carrying the seed's exact markers.
// Real bookings and any appointment with subsequent history are left unchanged.
function parts(date,zone){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]))}
function instant(day,minutes,zone){const wall=day+'T'+String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');const target=Date.parse(wall+':00Z');let result=target;for(let i=0;i<4;i++){const p=parts(new Date(result),zone),represented=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);const delta=target-represented;if(!delta)break;result+=delta}return new Date(result)}
async function repairDemoHours(db){
 const tickets=await db.ticket.findMany({where:{tenant:{name:'Rubber Doggies Grooming'},status:'CONFIRMED',bookingSource:'STAFF',durationMin:30,totalCents:8000,lines:{some:{description:'Demo Full Groom',unitPriceCents:8000}},scheduledStart:{not:null}},include:{location:true,pets:{include:{pet:true}},scheduleHistory:true}});let repaired=0;
 for(const t of tickets){const old=t.scheduledStart,zone=t.location.timezone||'America/Chicago',history=t.scheduleHistory;
 if(!t.pets.length||!t.pets.every(p=>/^Fluffy \d+$/.test(p.pet.name))||history.length!==1||history[0].changeType!=='CREATED'||history[0].actorUserId||+history[0].newStart!==+old||old.getUTCMinutes()%30!==0||old.getUTCHours()<8||old.getUTCHours()>12)continue;
 const p=parts(old,zone),localMinutes=Number(p.hour)*60+Number(p.minute);if(localMinutes>=510&&localMinutes+30<=1020)continue;
 const target=instant(old.toISOString().slice(0,10),old.getUTCHours()*60+old.getUTCMinutes()+30,zone);
 const setting=await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:t.tenantId,settingKey:`OPERATING_HOURS:${t.locationId}`}}});const day=new Date(old.toISOString().slice(0,10)+'T12:00:00Z').getUTCDay(),hours=Array.isArray(setting?.value)?setting.value.find(h=>h.day===day):{open:'08:30',close:'17:00',closed:false},q=parts(target,zone),end=parts(new Date(+target+1800000),zone);
 if(!hours||hours.closed||`${q.hour}:${q.minute}`<hours.open||`${end.hour}:${end.minute}`>hours.close)continue;
 repaired+=await db.$transaction(async tx=>{if(await tx.ticketScheduleHistory.count({where:{ticketId:t.id}})!==1)return 0;const changed=await tx.ticket.updateMany({where:{id:t.id,scheduledStart:old,status:'CONFIRMED'},data:{scheduledStart:target}});if(!changed.count)return 0;await tx.ticketScheduleHistory.create({data:{tenantId:t.tenantId,ticketId:t.id,changeType:'MOVED',previousStart:old,newStart:target}});return 1});
 }
 return repaired;
}
module.exports={repairDemoHours};

