import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const DEFAULT_ASSETS = [
  ["Grooming", "GROOMING", "08:30", "14:00"], ["Full Wash", "FULL_WASH", "09:30", "15:00"],
  ["Self Service", "SELFSERVICE", "11:30", "16:30"], ["Nail Grinding", "NAIL_GRINDING", "13:30", "16:30"],
  ["VIP Grooming", "VIP_GROOMING", "08:30", "14:00"], ["VIP Full Wash", "VIP_FULL_WASH", "08:30", "15:00"],
  ["VIP Brush-out-Session", "VIP_BRUSH_OUT", "09:30", "15:00"], ["VIP Self Service", "VIP_SELFSERVICE", "11:30", "16:30"],
] as const;
function databaseConfig(){const host=process.env.DB_HOST,name=process.env.DB_NAME,user=process.env.DB_USER,password=process.env.DB_PASSWORD;if(!host||!name||!user||password===undefined)return null;return{host,port:Number(process.env.DB_PORT||"3306"),user,password,database:name}}
function tenantFrom(r:NextRequest){return r.headers.get("x-tenant-id")||r.cookies.get("groompro_tenant")?.value||process.env.GROOMPRO_DEV_TENANT_ID||null}
export async function GET(request:NextRequest){
 const sv=request.nextUrl.searchParams.get("start"),ev=request.nextUrl.searchParams.get("end");if(!sv||!ev)return NextResponse.json({error:"start and end are required."},{status:400});
 const start=new Date(sv),end=new Date(ev);if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start)return NextResponse.json({error:"Invalid calendar range."},{status:400});
 let tenantId=tenantFrom(request),locationId=request.nextUrl.searchParams.get("locationId")||process.env.GROOMPRO_DEV_LOCATION_ID||null;
 let employees:any[]=[],tickets:any[]=[],assets:any[]=[],warnings:string[]=[];const config=databaseConfig();let connection:mysql.Connection|null=null;
 try{
  if(!config){warnings.push("Hosted database connection is not available yet.");return NextResponse.json({tickets,employees,assets:DEFAULT_ASSETS.map(([name,category,startTime,endTime],i)=>({id:`default-asset-${i+1}`,name,category,active:true,startTime,endTime})),tenantId,locationId,ready:true,warnings})}
  connection=await mysql.createConnection(config);
  if(!tenantId){const[r]=await connection.query("SELECT id FROM Tenant ORDER BY createdAt ASC LIMIT 1");tenantId=(r as any[])[0]?.id||null}
  if(tenantId&&!locationId){const[r]=await connection.query("SELECT id FROM Location WHERE tenantId=? ORDER BY createdAt ASC LIMIT 1",[tenantId]);locationId=(r as any[])[0]?.id||null}
  if(tenantId&&locationId){
   try{const[r]=await connection.query("SELECT id,firstName,lastName,role,active FROM User WHERE tenantId=? AND locationId=? ORDER BY active DESC,lastName ASC,firstName ASC",[tenantId,locationId]);employees=(r as any[]).map(x=>({...x,active:Boolean(x.active)}))}catch(e){console.error("Calendar employees",e);warnings.push("Employee data is not available yet.")}
   try{
    const[r]=await connection.query(`SELECT t.id,t.orderNumber,t.scheduledStart,t.status,c.firstName customerFirstName,c.lastName customerLastName,tp.petId,p.name petName,p.breed petBreed,tl.id lineId,tl.description lineDescription,ta.userId assignmentUserId,ta.role assignmentRole,u.firstName assignmentFirstName,u.lastName assignmentLastName FROM Ticket t JOIN Customer c ON c.id=t.customerId LEFT JOIN TicketPet tp ON tp.ticketId=t.id LEFT JOIN Pet p ON p.id=tp.petId LEFT JOIN TicketLine tl ON tl.ticketId=t.id LEFT JOIN TicketAssignment ta ON ta.ticketId=t.id LEFT JOIN User u ON u.id=ta.userId WHERE t.tenantId=? AND t.locationId=? AND t.scheduledStart>=? AND t.scheduledStart<? AND t.status<>? ORDER BY t.scheduledStart ASC,tl.sortOrder ASC`,[tenantId,locationId,start,end,"CANCELLED"]);
    const map=new Map<string,any>();for(const row of r as any[]){let t=map.get(row.id);if(!t){t={id:row.id,orderNumber:row.orderNumber,scheduledStart:row.scheduledStart,status:row.status,customer:{firstName:row.customerFirstName,lastName:row.customerLastName},pets:[],lines:[],assignments:[]};map.set(row.id,t)}if(row.petId&&!t.pets.some((x:any)=>x.pet.id===row.petId))t.pets.push({pet:{id:row.petId,name:row.petName,breed:row.petBreed}});if(row.lineId&&!t.lines.some((x:any)=>x.id===row.lineId))t.lines.push({id:row.lineId,description:row.lineDescription});if(row.assignmentUserId&&!t.assignments.some((x:any)=>x.user.id===row.assignmentUserId&&x.role===row.assignmentRole))t.assignments.push({user:{id:row.assignmentUserId,firstName:row.assignmentFirstName,lastName:row.assignmentLastName},role:row.assignmentRole})}tickets=[...map.values()]
   }catch(e){console.error("Calendar tickets",e);warnings.push("Appointment data is not available yet.")}
   try{const day=start.getDay();const[r]=await connection.query("SELECT a.id,a.name,a.category,a.active,s.startTime,s.endTime FROM BookingAsset a LEFT JOIN BookingAssetSchedule s ON s.assetId=a.id AND s.dayOfWeek=? AND s.active=1 WHERE a.tenantId=? AND a.locationId=? AND a.active=1 ORDER BY a.category,a.name",[day,tenantId,locationId]);assets=(r as any[]).map(x=>({id:x.id,name:x.name,category:x.category,active:Boolean(x.active),startTime:x.startTime||"",endTime:x.endTime||""}))}catch(e){console.error("Calendar assets",e);warnings.push("Configured booking assets are not available yet.")}
  }
 }catch(e){console.error("Calendar database",e);warnings.push("Calendar is using its built-in schedule while the database is being initialized.")}
 finally{if(connection)await connection.end().catch(()=>undefined)}
 if(!assets.length)assets=DEFAULT_ASSETS.map(([name,category,startTime,endTime],i)=>({id:`default-asset-${i+1}`,name,category,active:true,startTime,endTime}));
 return NextResponse.json({tickets,employees,assets,tenantId,locationId,ready:true,warnings})
}
