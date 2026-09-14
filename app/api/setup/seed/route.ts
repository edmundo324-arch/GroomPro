import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { db } from "@/src/lib/db";

const employees = [
  { firstName: "Edmundo", lastName: "Saenz", title: "Owner", role: "ADMIN", pin: "1233" },
  { firstName: "Zagla", lastName: "Saenz", title: "Owner", role: "ADMIN", pin: "4566" },
  { firstName: "Abby", lastName: "Ensing", title: "Manager", role: "MANAGER", pin: "1111" },
  { firstName: "Zagla", lastName: "Paz", title: "Manager", role: "MANAGER", pin: "7899" },
  { firstName: "Ruby", lastName: "Paz", title: "Outside Sales / Marketing", role: "SALES", pin: "0000" },
  { firstName: "Arianna", lastName: "Petro", title: "Sales/CSR", role: "SALES", pin: "9999" },
  { firstName: "Lisa", lastName: "Allen", title: "Groomer", role: "GROOMER", pin: "2222" },
  { firstName: "Kandance", lastName: "Krueger", title: "Groomer", role: "GROOMER", pin: "3333" },
  { firstName: "Hailey", lastName: "Puly", title: "Bather", role: "BACK", pin: "4444" },
  { firstName: "Lyndsey", lastName: "Culwell", title: "Bather", role: "BACK", pin: "6666" },
  { firstName: "Anton", lastName: "Johnson", title: "Bather", role: "BACK", pin: "7777" },
] as const;
const employeeWorkDays: Record<string, number[]> = {
  "Edmundo Saenz":[1,2,3,4,5],"Zagla Saenz":[1,2,3,5,6],"Abby Ensing":[1,2,3,5,6],"Zagla Paz":[1,2,4,5,6],"Ruby Paz":[1,2,3,4,6],"Arianna Petro":[1,3,4,5,6],"Lisa Allen":[2,3,4,5,6],"Kandance Krueger":[1,3,4,5,6],"Hailey Puly":[1,2,3,4,5],"Lyndsey Culwell":[1,2,3,5,6],"Anton Johnson":[1,2,4,5,6]
};
const dogBreeds=["Golden Retriever","Yorkshire Terrier","Shih Tzu","Poodle","Labrador Retriever","Australian Shepherd","Doodle","Cocker Spaniel","German Shepherd","Maltese","Schnauzer","French Bulldog","Cavalier King Charles Spaniel","Border Collie","Havanese","Chihuahua","Bichon Frise","Pomeranian","Beagle","Dachshund"];
const numberNames=["One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen","Twenty"];
const lastNames=["Jones","Smith","Williams","Brown","Davis","Miller","Wilson","Moore","Taylor","Anderson","Thomas","Jackson","White","Harris","Martin","Thompson","Garcia","Martinez","Robinson","Clark"];
const assetSchedules:Record<string,{start:string;end:string}>={"Grooming":{start:"08:30",end:"14:00"},"Full Wash":{start:"09:30",end:"15:00"},"Self Service":{start:"11:30",end:"16:30"},"Nail Grinding":{start:"13:30",end:"16:30"},"VIP Grooming":{start:"08:30",end:"14:00"},"VIP Full Wash":{start:"08:30",end:"15:00"},"VIP Brush-out-Session":{start:"09:30",end:"15:00"},"VIP Self Service":{start:"11:30",end:"16:30"}};
const assetCategories=Object.keys(assetSchedules);
function hashPin(pin:string){const salt=randomBytes(16).toString("hex");return `${salt}:${scryptSync(pin,salt,64).toString("hex")}`;}
function shuffle<T>(items:T[]){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function at(date:Date,h:number,m:number){const d=new Date(date);d.setHours(h,m,0,0);return d;}

export async function POST(request:NextRequest){
 try{
  const expectedSecret=process.env.GROOMPRO_SETUP_SECRET;
  if(!expectedSecret||expectedSecret==="replace-with-a-long-random-secret")return NextResponse.json({error:"GROOMPRO_SETUP_SECRET is not configured."},{status:503});
  const body=await request.json().catch(()=>({}));
  if(body.secret!==expectedSecret)return NextResponse.json({error:"Invalid setup secret."},{status:401});
  const result=await db.$transaction(async tx=>{
   let tenantId=process.env.GROOMPRO_DEV_TENANT_ID||null;
   let tenant=tenantId?await tx.tenant.findUnique({where:{id:tenantId}}):null;
   if(!tenant)tenant=await tx.tenant.findFirst({orderBy:{createdAt:"asc"}});
   if(!tenant)tenant=await tx.tenant.create({data:{name:"Rubber Doggies Grooming"}});
   tenantId=tenant.id;
   let location=await tx.location.findFirst({where:{tenantId},orderBy:{createdAt:"asc"}});
   if(!location)location=await tx.location.create({data:{tenantId,name:"Main Location",city:"Cibolo",state:"TX",timezone:"America/Chicago"}});
   const employeeIds:string[]=[];
   for(const e of employees){
    const existing=await tx.user.findFirst({where:{tenantId,firstName:e.firstName,lastName:e.lastName}});
    const data={role:e.role as any,active:true,locationId:location.id,pinHash:hashPin(e.pin)};
    const user=existing?await tx.user.update({where:{id:existing.id},data}):await tx.user.create({data:{...data,tenantId,firstName:e.firstName,lastName:e.lastName}});
    await tx.$executeRaw`UPDATE User SET jobTitle=${e.title} WHERE id=${user.id}`;employeeIds.push(user.id);
    for(const day of employeeWorkDays[`${e.firstName} ${e.lastName}`]||[])await tx.$executeRaw`INSERT INTO EmployeeSchedule (id,tenantId,userId,dayOfWeek,startTime,endTime,active) VALUES (${randomUUID()},${tenantId},${user.id},${day},'08:30','17:00',1) ON DUPLICATE KEY UPDATE startTime='08:30',endTime='17:00',active=1`;
   }
   const customerIds:string[]=[];
   for(let i=1;i<=100;i++){
    const firstName=i<=20?numberNames[i-1]:"Customer",lastName=i<=20?lastNames[i-1]:String(i),normalized=`210123${String(4500+i)}`,number=`210-123-${String(4500+i)}`;
    const ep=await tx.customerPhone.findFirst({where:{tenantId,normalized}});
    let c=ep?await tx.customer.findUnique({where:{id:ep.customerId}}):await tx.customer.findFirst({where:{tenantId,firstName,lastName}});
    if(!c)c=await tx.customer.create({data:{tenantId,firstName,lastName,city:"Cibolo",state:"TX"}});
    await tx.customerPhone.upsert({where:{tenantId_normalized:{tenantId,normalized}},update:{customerId:c.id,number,isPrimary:true},create:{tenantId,customerId:c.id,number,normalized,label:"Mobile",isPrimary:true}});
    const petName=`Fluffy ${i}`;const pet=await tx.pet.findFirst({where:{tenantId,customerId:c.id,name:petName}});if(!pet)await tx.pet.create({data:{tenantId,customerId:c.id,name:petName,breed:dogBreeds[(i-1)%dogBreeds.length]}});customerIds.push(c.id);
   }
   let assetCount=0,assetScheduleCount=0;
   for(const category of assetCategories){
    const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM BookingAsset WHERE tenantId=${tenantId} AND locationId=${location.id} AND category=${category} LIMIT 1`;const assetId=rows[0]?.id||randomUUID();
    if(!rows.length)await tx.$executeRaw`INSERT INTO BookingAsset (id,tenantId,locationId,name,category,onlineBookingRecipient,active) VALUES (${assetId},${tenantId},${location.id},${category},${category},1,1)`;
    const s=assetSchedules[category];for(let day=1;day<=6;day++){await tx.$executeRaw`INSERT INTO BookingAssetSchedule (id,assetId,dayOfWeek,startTime,endTime,active) VALUES (${randomUUID()},${assetId},${day},${s.start},${s.end},1) ON DUPLICATE KEY UPDATE startTime=${s.start},endTime=${s.end},active=1`;assetScheduleCount++;}assetCount++;
   }
   const groomers=await tx.user.findMany({where:{tenantId,role:"GROOMER",active:true},select:{id:true,firstName:true,lastName:true}});
   const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+14);const already=await tx.ticket.count({where:{tenantId,locationId:location.id,scheduledStart:{gte:start,lt:end}}});let demoAppointmentCount=0;
   if(!already&&groomers.length){const customers=shuffle(customerIds);let ci=0;const max=await tx.ticket.aggregate({where:{tenantId},_max:{orderNumber:true}});let order=(max._max.orderNumber||0)+1;
    for(let offset=0;offset<14;offset++){const date=new Date(start);date.setDate(start.getDate()+offset);const day=date.getDay();if(day===0)continue;const count=day===5?18:day===6?16:6;const available=groomers.filter(g=>employeeWorkDays[`${g.firstName} ${g.lastName}`]?.includes(day));const workers=available.length?available:groomers;
     for(let i=0;i<count;i++){const worker=workers[i%workers.length],customerId=customers[ci++%customers.length],pet=await tx.pet.findFirst({where:{tenantId,customerId,active:true},orderBy:{createdAt:"asc"}});if(!pet)continue;const slot=Math.floor(i/workers.length),when=at(date,8+Math.floor(slot/2),slot%2?30:0);
      const ticket=await tx.ticket.create({data:{tenantId,locationId:location.id,customerId,orderNumber:order++,scheduledStart:when,durationMin:30,status:"CONFIRMED",bookingSource:"STAFF",bookingDecision:"ACCEPTED",totalCents:8000,salesTaxCents:0,pets:{create:{petId:pet.id,weightLbs:25}},lines:{create:{lineType:"SERVICE",role:"GROOM",petId:pet.id,description:"Demo Full Groom",quantity:1,unitPriceCents:8000,totalCents:8000,commissionCents:1600,commissionPct:20}},assignments:{create:{userId:worker.id,role:"GROOMER"}}}});await tx.ticketScheduleHistory.create({data:{tenantId,ticketId:ticket.id,changeType:"CREATED",newStart:when}});demoAppointmentCount++;}
    }
   }
   return {tenantId,locationId:location.id,employeeCount:employeeIds.length,customerCount:customerIds.length,assetCount,assetScheduleCount,demoAppointmentCount};
  });
  const response=NextResponse.json({ok:true,seeded:result});response.cookies.set("groompro_tenant",result.tenantId,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*30});return response;
 }catch(error){console.error("Seed failed",error);return NextResponse.json({error:error instanceof Error?error.message:"Seed failed."},{status:500});}
}
