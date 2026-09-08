import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";
function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }
function dayBounds(dateValue:string){const start=new Date(`${dateValue}T00:00:00`);const end=new Date(start);end.setDate(end.getDate()+1);return {start,end};}
const ticketInclude={customer:{select:{id:true,firstName:true,lastName:true}},pets:{include:{pet:{select:{id:true,name:true,breed:true}}}},lines:{orderBy:{sortOrder:"asc" as const},include:{assignedUser:{select:{id:true,firstName:true,lastName:true}},pet:{select:{id:true,name:true}}}}};

export async function GET(request: NextRequest) {
  const tenantId=tenantFrom(request);const locationId=request.nextUrl.searchParams.get("locationId")||process.env.GROOMPRO_DEV_LOCATION_ID||"";const dateValue=request.nextUrl.searchParams.get("date");
  if(!tenantId||!locationId||!dateValue)return NextResponse.json({error:"Tenant, location, and date are required."},{status:400});
  const {start,end}=dayBounds(dateValue);if(Number.isNaN(start.getTime()))return NextResponse.json({error:"Invalid Whiteboard date."},{status:400});
  const snapshot=await db.whiteboardSnapshot.findUnique({where:{locationId_businessDate:{locationId,businessDate:start}},include:{items:{orderBy:{sequence:"asc"},include:{ticket:{include:ticketInclude}}}}});
  const pushedTickets=snapshot?snapshot.items.filter(i=>i.ticket.status!=="CANCELLED").map(i=>i.ticket):[];
  const pushedIds=new Set(pushedTickets.map(t=>t.id));
  const lateTickets=await db.ticket.findMany({where:{tenantId,locationId,scheduledStart:{gte:start,lt:end},status:{notIn:["CANCELLED"]},...(pushedIds.size?{id:{notIn:[...pushedIds]}}:{})},orderBy:[{scheduledStart:"asc"},{orderNumber:"asc"}],include:ticketInclude});
  const tickets=[...pushedTickets,...lateTickets];
  const employees=await db.user.findMany({where:{tenantId,active:true,OR:[{locationId},{locationId:null}]},orderBy:[{firstName:"asc"},{lastName:"asc"}],select:{id:true,firstName:true,lastName:true,role:true,active:true}});
  return NextResponse.json({tickets,snapshot:snapshot?{id:snapshot.id,snapshotAt:snapshot.snapshotAt,itemCount:snapshot.items.length}:null,employees});
}

export async function POST(request:NextRequest){
  const tenantId=tenantFrom(request);const locationId=request.nextUrl.searchParams.get("locationId")||process.env.GROOMPRO_DEV_LOCATION_ID||"";
  if(!tenantId||!locationId)return NextResponse.json({error:"Tenant and location context are required."},{status:401});
  const sessionId=request.cookies.get(SESSION_COOKIE)?.value||"";const session=sessionId?await getActiveEmployeeSession(tenantId,sessionId):null;if(!session)return NextResponse.json({error:"Employee PIN is required before pushing the Whiteboard."},{status:401});
  let body:{date?:string};try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400})}
  if(!body.date)return NextResponse.json({error:"A Whiteboard business date is required."},{status:400});
  const {start,end}=dayBounds(body.date);if(Number.isNaN(start.getTime()))return NextResponse.json({error:"Invalid Whiteboard date."},{status:400});
  const tickets=await db.ticket.findMany({where:{tenantId,locationId,scheduledStart:{gte:start,lt:end},status:{notIn:["CANCELLED"]}},orderBy:[{scheduledStart:"asc"},{orderNumber:"asc"}],select:{id:true,orderNumber:true,scheduledStart:true}});
  const snapshot=await db.$transaction(async tx=>{const existing=await tx.whiteboardSnapshot.findUnique({where:{locationId_businessDate:{locationId,businessDate:start}}});if(existing){await tx.whiteboardSnapshotItem.deleteMany({where:{snapshotId:existing.id}});return tx.whiteboardSnapshot.update({where:{id:existing.id},data:{snapshotAt:new Date(),createdByUserId:session.user.id,items:{create:tickets.map((t,index)=>({ticketId:t.id,sequence:index+1,scheduledStartAtPush:t.scheduledStart}))}}});}return tx.whiteboardSnapshot.create({data:{tenantId,locationId,businessDate:start,createdByUserId:session.user.id,items:{create:tickets.map((t,index)=>({ticketId:t.id,sequence:index+1,scheduledStartAtPush:t.scheduledStart}))}}});});
  await writeAudit({tenantId,actorUserId:session.user.id,entityType:"TICKET",entityId:tickets[0]?.id||snapshot.id,action:"WHITEBOARD_PUSH",summary:`Prepared ${tickets.length} appointments for the Whiteboard for ${body.date}.`,details:{businessDate:body.date,ticketCount:tickets.length,snapshotId:snapshot.id,keepsScheduledGroomerOnTicketAndCalendar:true}});
  return NextResponse.json({snapshot,ticketCount:tickets.length});
}

export async function PATCH(request: NextRequest) {
  const tenantId=tenantFrom(request);const locationId=request.nextUrl.searchParams.get("locationId")||process.env.GROOMPRO_DEV_LOCATION_ID||"";
  if(!tenantId||!locationId)return NextResponse.json({error:"Tenant and location context are required."},{status:401});
  const sessionId=request.cookies.get(SESSION_COOKIE)?.value||"";const session=sessionId?await getActiveEmployeeSession(tenantId,sessionId):null;if(!session)return NextResponse.json({error:"Employee PIN is required before changing the Whiteboard."},{status:401});
  let body:{ticketId?:string;action?:"PRIORITY"|"VIP"|"ANAL"|"ASSIGN";value?:number|string|null;petId?:string;lineRole?:"PREP"|"BATH"|"GROOM";userId?:string|null};try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400})}
  if(!body.ticketId||!body.action)return NextResponse.json({error:"Ticket and Whiteboard action are required."},{status:400});
  const ticket=await db.ticket.findFirst({where:{id:body.ticketId,tenantId,locationId},include:{pets:true,lines:true}});if(!ticket)return NextResponse.json({error:"Ticket could not be found."},{status:404});
  if(body.action==="PRIORITY"){if(body.value!==null&&body.value!==undefined&&(!/^\d+$/.test(String(body.value))||Number(body.value)<1))return NextResponse.json({error:"Priority must be a positive whole number."},{status:400});const updated=await db.ticket.update({where:{id:ticket.id},data:{arrivalPriority:body.value===null||body.value===undefined?null:Number(body.value)}});await writeAudit({tenantId,actorUserId:session.user.id,entityType:"TICKET",entityId:ticket.id,customerId:ticket.customerId,action:"WHITEBOARD_PRIORITY",summary:`Changed Whiteboard priority for order #${ticket.orderNumber}.`,details:{previous:ticket.arrivalPriority,next:updated.arrivalPriority,entryMethod:"EMPLOYEE_TOUCH_OR_FRONT_DESK"}});return NextResponse.json({ticket:updated});}
  if(body.action==="ASSIGN"){
    if(!body.petId||!ticket.pets.some(p=>p.petId===body.petId))return NextResponse.json({error:"A dog on this ticket must be selected."},{status:400});
    if(!body.lineRole)return NextResponse.json({error:"Workflow assignment role is required."},{status:400});
    if(body.userId){const employee=await db.user.findFirst({where:{id:body.userId,tenantId,active:true,OR:[{locationId},{locationId:null}]},select:{id:true}});if(!employee)return NextResponse.json({error:"Employee could not be found."},{status:404});}
    const line=await db.ticketLine.findFirst({where:{ticketId:ticket.id,petId:body.petId,role:body.lineRole}});if(!line)return NextResponse.json({error:"Workflow service line could not be found for this dog."},{status:404});
    if(body.lineRole==="GROOM"){
      const prep=await db.ticketLine.findFirst({where:{ticketId:ticket.id,petId:body.petId,role:"PREP"},select:{assignedUserId:true}});const bath=await db.ticketLine.findFirst({where:{ticketId:ticket.id,petId:body.petId,role:"BATH"},select:{assignedUserId:true}});
      if(!ticket.checkedInAt||!prep?.assignedUserId||!bath?.assignedUserId)return NextResponse.json({error:"Groomed By is assigned after arrival and after Prepared By and Washed By are assigned."},{status:409});
    }
    const now=new Date();
    const updated=await db.$transaction(async tx=>{
      const changed=await tx.ticketLine.update({where:{id:line.id},data:{assignedUserId:body.userId||null,assignedAt:body.userId?now:null}});
      if(body.lineRole==="GROOM"){
        await tx.ticketAssignment.deleteMany({where:{ticketId:ticket.id,role:"GROOMER"}});
        if(body.userId)await tx.ticketAssignment.create({data:{ticketId:ticket.id,userId:body.userId,role:"GROOMER",assignedAt:now}});
      }
      return changed;
    });
    await writeAudit({tenantId,actorUserId:session.user.id,entityType:"TICKET",entityId:ticket.id,customerId:ticket.customerId,action:"WHITEBOARD_ASSIGN",summary:`Changed ${body.lineRole} assignment for order #${ticket.orderNumber}.`,details:{petId:body.petId,role:body.lineRole,previousUserId:line.assignedUserId,nextUserId:body.userId||null,source:"WHITEBOARD",synchronizesTicketAndCalendar:body.lineRole==="GROOM"}});
    return NextResponse.json({line:updated});
  }
  if(!body.petId||!ticket.pets.some(p=>p.petId===body.petId))return NextResponse.json({error:"A dog on this ticket must be selected."},{status:400});const pet=ticket.pets.find(p=>p.petId===body.petId)!;
  if(body.action==="VIP"){const value=body.value as string;if(!["AVAILABLE","NOT_AVAILABLE","NEEDS_MORE_SESSIONS"].includes(value))return NextResponse.json({error:"Invalid VIP availability."},{status:400});const updated=await db.ticketPet.update({where:{id:pet.id},data:{vipAvailability:value as any}});await writeAudit({tenantId,actorUserId:session.user.id,entityType:"TICKET",entityId:ticket.id,customerId:ticket.customerId,action:"WHITEBOARD_VIP",summary:`Changed VIP availability for ${body.petId} on order #${ticket.orderNumber}.`,details:{petId:body.petId,previous:pet.vipAvailability,next:value,source:"WHITEBOARD"}});return NextResponse.json({ticketPet:updated});}
  const value=body.value as string;if(!["DONE_REQUESTED","DONE_NOT_REQUESTED","NOT_NEEDED"].includes(value))return NextResponse.json({error:"Invalid anal situation status."},{status:400});const updated=await db.ticketPet.update({where:{id:pet.id},data:{analSituation:value as any}});await writeAudit({tenantId,actorUserId:session.user.id,entityType:"TICKET",entityId:ticket.id,customerId:ticket.customerId,action:"WHITEBOARD_ANAL",summary:`Changed Anal Situation for ${body.petId} on order #${ticket.orderNumber}.`,details:{petId:body.petId,previous:pet.analSituation,next:value,source:"WHITEBOARD"}});return NextResponse.json({ticketPet:updated});
}
