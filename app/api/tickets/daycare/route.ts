import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { writeAudit } from "@/src/lib/audit";
import { getActiveEmployeeSession } from "@/src/lib/employee-session";

const SESSION_COOKIE = "groompro_session";
function tenantFrom(request: NextRequest) { return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || ""; }

export async function PATCH(request: NextRequest) {
  const tenantId=tenantFrom(request);const locationId=request.nextUrl.searchParams.get("locationId")||process.env.GROOMPRO_DEV_LOCATION_ID||"";
  if(!tenantId||!locationId)return NextResponse.json({error:"Tenant and location context are required."},{status:401});
  const sessionId=request.cookies.get(SESSION_COOKIE)?.value||"";const session=sessionId?await getActiveEmployeeSession(tenantId,sessionId):null;if(!session)return NextResponse.json({error:"Employee PIN is required before changing daycare status."},{status:401});
  let body:{ticketId?:string;staying?:boolean};try{body=await request.json()}catch{return NextResponse.json({error:"Invalid request."},{status:400})}
  if(!body.ticketId||typeof body.staying!=="boolean")return NextResponse.json({error:"Ticket and daycare selection are required."},{status:400});
  const ticket=await db.ticket.findFirst({where:{id:body.ticketId,tenantId,locationId},include:{customer:true,pets:{include:{pet:true}}}});if(!ticket)return NextResponse.json({error:"Ticket could not be found."},{status:404});
  if(ticket.status!=="READY")return NextResponse.json({error:"Daycare is offered and assigned while the ticket is ready for pickup, before checkout is closed."},{status:409});
  const daycareService=await db.service.findFirst({where:{tenantId,active:true,OR:[{category:"DAYCARE"},{name:"Daycare"}]},orderBy:[{category:"asc"},{name:"asc"}]});
  if(!daycareService)return NextResponse.json({error:"A Daycare service must be configured in Services before Daycare can be added to a ticket."},{status:409});
  const existingLine=await db.ticketLine.findFirst({where:{ticketId:ticket.id,serviceId:daycareService.id,role:"ADD_ON",petId:null}});
  if(body.staying&&!existingLine){
    const commissionPct=daycareService.commissionPct==null?null:Number(daycareService.commissionPct);const totalCents=daycareService.priceCents;const commissionCents=commissionPct==null?0:Math.round(totalCents*commissionPct/100);
    const updated=await db.$transaction(async tx=>{await tx.ticketLine.create({data:{ticketId:ticket.id,lineType:"SERVICE",role:"ADD_ON",serviceId:daycareService.id,petId:null,description:daycareService.name,quantity:1,unitPriceCents:daycareService.priceCents,totalCents,commissionPct,commissionCents,sortOrder:999999}});return tx.ticket.update({where:{id:ticket.id},data:{daycareStatus:"STAYING",daycareAddedAt:new Date(),daycareAddedByUserId:session.user.id},include:{customer:true,pets:{include:{pet:true}},lines:true}})});
    await writeAudit({tenantId,actorUserId:session.user.id,entityType:"TICKET",entityId:ticket.id,customerId:ticket.customerId,action:"ADD_DAYCARE",summary:`Added ticket-level daycare for order #${ticket.orderNumber}.`,details:{ticketLevel:true,affectsAllDogsOnTicket:true,petIds:ticket.pets.map(p=>p.petId),serviceId:daycareService.id,priceCents:daycareService.priceCents}});
    return NextResponse.json({ticket:updated,daycareStatus:updated.daycareStatus,affectsAllDogsOnTicket:true});
  }
  if(!body.staying&&existingLine){
    const updated=await db.$transaction(async tx=>{await tx.ticketLine.delete({where:{id:existingLine.id}});return tx.ticket.update({where:{id:ticket.id},data:{daycareStatus:"NONE",daycareAddedAt:null,daycareAddedByUserId:null},include:{customer:true,pets:{include:{pet:true}},lines:true}})});
    await writeAudit({tenantId,actorUserId:session.user.id,entityType:"TICKET",entityId:ticket.id,customerId:ticket.customerId,action:"REMOVE_DAYCARE",summary:`Removed ticket-level daycare for order #${ticket.orderNumber}.`,details:{ticketLevel:true,affectsAllDogsOnTicket:true,petIds:ticket.pets.map(p=>p.petId),serviceId:daycareService.id}});
    return NextResponse.json({ticket:updated,daycareStatus:updated.daycareStatus,affectsAllDogsOnTicket:true});
  }
  if(body.staying&&existingLine)return NextResponse.json({ticket,daycareStatus:"STAYING",affectsAllDogsOnTicket:true});
  return NextResponse.json({ticket,daycareStatus:"NONE",affectsAllDogsOnTicket:true});
}
