import {sendCustomerSms} from '@/src/lib/sms';
import {normalizePhone} from '@/src/lib/customer';
import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {requestLocation} from '@/src/lib/request-location';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {moduleDenial} from '@/src/lib/module-entitlement';
import {customerReportCardKey,readCustomerReportCard,saveCustomerReportCard,customerReportCardHtml} from '@/src/lib/customer-report-card';
import {readAppointmentMessageSettings} from '@/src/lib/appointment-message-store';
import {sendCustomerEmail} from '@/src/lib/customer-email';
async function handle(r:NextRequest){const session=await platformSession(r);if(!session)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});try{
 const tenantId=session.tenantId,locationId=await requestLocation(r,tenantId),ticketId=r.nextUrl.searchParams.get('ticketId')||'',ticket=locationId&&await db.ticket.findFirst({where:{tenantId,locationId,id:ticketId},include:{customer:{select:{email:true,phones:{where:{smsEnabled:true},orderBy:{isPrimary:'desc'}}}},tenant:{select:{name:true}}}});if(!ticket)throw Error('Choose a saved ticket at this shop.');
 const reply=(body:object)=>NextResponse.json(body,{headers:{'Cache-Control':'no-store'}});
 if(r.method==='GET'){if(r.nextUrl.searchParams.get('format')==='html')return reply({html:customerReportCardHtml(await readCustomerReportCard(tenantId,ticketId,undefined,r.nextUrl.searchParams.has('revision')?Number(r.nextUrl.searchParams.get('revision')):undefined))});const saved=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:customerReportCardKey(ticketId)}}}))?.value as any,rows=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'PET_PHOTO:'},value:{path:'$.ticketId',equals:ticketId}},select:{value:true}});const history=await db.tenantSetting.findMany({where:{tenantId,settingKey:{startsWith:'CUSTOMER_REPORT_CARD_VERSION:'+ticketId+':'}},select:{value:true}});return reply({ticketClosed:ticket.status==='CLOSED',closingMode:(await readAppointmentMessageSettings(tenantId)).policy.reportCardMode,versions:history.map(r=>({revision:(r.value as any).revision,updatedAt:(r.value as any).updatedAt})).sort((a,b)=>b.revision-a.revision),saved:saved||null,email:ticket.customer.email,phones:ticket.customer.phones,photos:rows.map(r=>{const p=r.value as any;return {id:p.id,date:p.date,stage:p.stage,caption:p.caption,name:p.name}})});}
 const b=await r.json();if(r.method==='PUT')return reply({saved:await saveCustomerReportCard(tenantId,session.user.id,ticketId,b)});
 const denial=await moduleDenial(r,'MESSAGING');if(denial)return denial;
 const saved=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId,settingKey:customerReportCardKey(ticketId)}}}))?.value as any;
 const channels=b.channels??['EMAIL'];if(!Array.isArray(channels)||!channels.length||channels.length>2||new Set(channels).size!==channels.length||channels.some((c:string)=>!['EMAIL','SMS'].includes(c)))throw Error('Choose text, email, or both.');
 if(!saved||saved.revision!==b.revision||(channels.includes('EMAIL')&&ticket.customer.email!==b.email))throw Error('The report card or customer email changed. Refresh and review before sending.');
 if(!/^[a-f0-9-]{36}$/i.test(b.requestId||''))throw Error('Reopen this report card before sending it.');
 const origin=(await readAppointmentMessageSettings(tenantId)).policy.publicOrigin;if(!origin)throw Error('Save the customer website address in Settings → Communications → Automatic appointment messages before sending report-card links.');
 const portal=new URL('/portal',origin);portal.searchParams.set('tenant',tenantId);portal.searchParams.set('location',locationId);const body=ticket.tenant.name+': Your grooming report card for ticket #'+ticket.orderNumber+' is ready. Sign in to view it and its photos: '+portal.href;
 const results=[];for(const channel of channels){try{const id='report_'+createHash('sha256').update(tenantId+':'+ticketId+':'+b.requestId+':'+channel).digest('hex');let result;
 if(channel==='SMS'){const phone=ticket.customer.phones.find(p=>p.id===b.phoneId);if(!phone||phone.number!==b.phoneNumber)throw Error('Review the customer’s texting number before sending the report card.');const digits=normalizePhone(phone.number),to=phone.number.trim().startsWith('+')?'+'+phone.number.replace(/\D/g,''):digits.length===10?'+1'+digits:'+'+digits;result=await sendCustomerSms({tenantId,customerId:ticket.customerId,ticketId,phoneId:phone.id,body,subject:'Grooming report card',operation:{id,expectedPhone:to}});
 }else result=await sendCustomerEmail({tenantId,customerId:ticket.customerId,body,document:{id,ticketId,subject:ticket.tenant.name+' · Grooming report card',expectedEmail:b.email,html:'<p>'+body.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))+'</p>'}});
 results.push({channel,message:result.message,status:result.communication.deliveryStatus});}catch(e){results.push({channel,message:(e as Error).message,status:'NOT_SENT'});}}
 return reply({results,message:results.map(r=>(r.channel==='SMS'?'Text: ':'Email: ')+r.message).join(' ')});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});
export const PUT=withRequestPolicy(handle,{feature:'TICKETS'});
export const POST=withRequestPolicy(handle,{feature:'TICKETS'});
