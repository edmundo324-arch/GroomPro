import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/src/lib/db";
const plan:[string,string,number[]][]=[
 ["Edmundo","Saenz",[1,2,3,4,5]],["Zagla","Saenz",[1,2,3,5,6]],
 ["Abby","Ensing",[1,2,3,5,6]],["Zagla","Paz",[1,2,4,5,6]],
 ["Ruby","Paz",[1,2,3,4,6]],["Arianna","Petro",[1,3,4,5,6]],
 ["Lisa","Allen",[2,3,4,5,6]],["Kandance","Krueger",[1,3,4,5,6]],
 ["Hailey","Puly",[1,2,3,4,5]],["Lyndsey","Culwell",[1,2,3,5,6]],["Anton","Johnson",[1,2,4,5,6]]
];
const hours:Record<string,[string,string]>={"Grooming":["08:30","14:00"],"Full Wash":["09:30","15:00"],"Self Service":["11:30","16:30"],"Nail Grinding":["13:30","16:30"],"VIP Grooming":["08:30","14:00"],"VIP Full Wash":["08:30","15:00"],"VIP Brush-out-Session":["09:30","15:00"],"VIP Self Service":["11:30","16:30"]};
export async function POST(request:NextRequest){
 const secret=process.env.GROOMPRO_SETUP_SECRET;
 const body=await request.json().catch(()=>({}));
 if(!secret||secret==="replace-with-a-long-random-secret"||body.secret!==secret)return NextResponse.json({error:"Invalid or unconfigured setup secret."},{status:401});
 try{
  const tenantId=request.headers.get("x-tenant-id")||request.cookies.get("groompro_tenant")?.value||process.env.GROOMPRO_DEV_TENANT_ID;
  const tenants=await db.tenant.findMany({where:tenantId?{id:tenantId}:undefined,take:2});
  if(tenants.length!==1)return NextResponse.json({error:"Run preview setup and select its business first."},{status:400});
  const tenant=tenants[0];
  const result=await db.$transaction(async tx=>{
   let employeeScheduleRows=0,assetScheduleRows=0;
   for(const[firstName,lastName,days]of plan){
    const user=await tx.user.findFirst({where:{tenantId:tenant.id,firstName,lastName}});if(!user)continue;
    for(const day of days){
     const existing=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM EmployeeSchedule WHERE tenantId=${tenant.id} AND userId=${user.id} AND dayOfWeek=${day} LIMIT 1`;
     if(!existing.length){await tx.$executeRaw`INSERT INTO EmployeeSchedule (id,tenantId,userId,dayOfWeek,startTime,endTime,active) VALUES (${randomUUID()},${tenant.id},${user.id},${day},'08:30','17:00',1)`;employeeScheduleRows++;}
    }
   }
   const assets=await tx.$queryRaw<Array<{id:string;category:string}>>`SELECT id,category FROM BookingAsset WHERE tenantId=${tenant.id}`;
   for(const asset of assets){const[start,end]=hours[asset.category]||["08:30","17:00"];for(let day=1;day<=6;day++){
    const existing=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM BookingAssetSchedule WHERE assetId=${asset.id} AND dayOfWeek=${day} LIMIT 1`;
    if(!existing.length){await tx.$executeRaw`INSERT INTO BookingAssetSchedule (id,assetId,dayOfWeek,startTime,endTime,active) VALUES (${randomUUID()},${asset.id},${day},${start},${end},1)`;assetScheduleRows++;}
   }}
   return {employeeScheduleRows,assetScheduleRows};
  },{maxWait:10000,timeout:120000});
  return NextResponse.json({ok:true,...result});
 }catch(error){console.error("Schedule setup failed",error);return NextResponse.json({error:"Unable to complete schedule setup. Check the app logs."},{status:500});}
}
