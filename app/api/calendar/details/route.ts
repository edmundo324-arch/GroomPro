import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {requestLocation} from '@/src/lib/request-location';
import {workflowSettings} from '@/src/lib/workflow-settings';
import {calendarHoverFields} from '@/src/lib/calendar-hover-fields';
export async function GET(r:NextRequest){
 const tenantId=r.headers.get('x-tenant-id')||process.env.GROOMPRO_DEV_TENANT_ID||'',locationId=tenantId?await requestLocation(r,tenantId):null;
 if(!tenantId||!locationId)return NextResponse.json({error:'Business context required.'},{status:401});
 const ticket=await db.ticket.findFirst({where:{id:r.nextUrl.searchParams.get('id')||'',tenantId,locationId},include:{customer:{include:{phones:true}},pets:{include:{pet:{include:{vaccinations:true}}}},lines:true,payments:true,assignments:{include:{user:{select:{firstName:true,lastName:true}}}}}});
 if(!ticket)return NextResponse.json({error:'Appointment not found.'},{status:404});
 const fields=(await workflowSettings(tenantId)).hoverFields;
 const text=(v:any):string=>v==null?'—':v instanceof Date?v.toISOString():Array.isArray(v)?v.map(text).join('; '):typeof v==='object'?JSON.stringify(v):String(v);
 const details=fields.filter((key:string)=>Object.hasOwn(calendarHoverFields,key)&&!['time','pet','package','notes','customer'].includes(key)).map((key:string)=>{
 const [group,field]=key.split('.');let value='—';
 if(group==='ticket')value=text((ticket as any)[field]);
 if(group==='customer')value=field==='phones'?ticket.customer.phones.map(p=>`${p.label||'Phone'}: ${p.number}`).join('; '):text((ticket.customer as any)[field]);
 if(group==='pet')value=ticket.pets.map(({pet})=>`${pet.name}: ${field==='vaccinations'?pet.vaccinations.map(v=>`${v.vaccineName} (${v.expiresAt?.toISOString().slice(0,10)||'no expiry'})`).join(', '):text((pet as any)[field])}`).join('; ');
 if(group==='line')value=ticket.lines.map(l=>`${l.description}: ${text((l as any)[field])}`).join('; ');
 if(key==='payments')value=ticket.payments.map(p=>`${p.paymentType}: $${Number(p.amount).toFixed(2)}`).join('; ');
 if(key==='assignments')value=ticket.assignments.map(a=>`${a.role}: ${a.user.firstName} ${a.user.lastName}`).join('; ');
 return {label:calendarHoverFields[key],value};
 });return NextResponse.json({details},{headers:{'Cache-Control':'no-store'}});
}
