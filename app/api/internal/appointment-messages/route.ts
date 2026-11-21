import {runConversationTenant} from '@/src/lib/customer-conversation-runner';
import {db} from '@/src/lib/db';
import {runCustomStaffRules} from '@/src/lib/custom-rule-runner';
import {runBirthdayMessages} from '@/src/lib/birthday-message-runner';
import {runPrepaidReminders} from '@/src/lib/prepaid-reminder-runner';
import {runVaccinationReminders} from '@/src/lib/vaccination-reminder-runner';
import {runWaitlistMatches} from '@/src/lib/waitlist-runner';
import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {runAppointmentMessages} from '@/src/lib/appointment-message-runner';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 const expected=process.env.GROOMPRO_SCHEDULER_TOKEN||'',actual=request.headers.get('x-groompro-scheduler')||'';
 if(expected.length<32||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return NextResponse.json({error:'Unauthorized.'},{status:401});
 try{const body=await request.json(),cursor=body.cursor;
  if(cursor!==null&&cursor!==undefined&&(!cursor||typeof cursor.tenantId!=='string'||typeof cursor.ticketId!=='string'||cursor.tenantId.length>191||cursor.ticketId.length>191))return NextResponse.json({error:'Invalid cursor.'},{status:400});
  const waitlistCursor=body.waitlistCursor;if(waitlistCursor!=null&&(typeof waitlistCursor.tenantId!=='string'||typeof waitlistCursor.entryKey!=='string'||waitlistCursor.tenantId.length>191||waitlistCursor.entryKey.length>191||(waitlistCursor.date!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(waitlistCursor.date))))return NextResponse.json({error:'Invalid waitlist cursor.'},{status:400});
  const vaccinationCursor=body.vaccinationCursor;if(vaccinationCursor!=null&&(typeof vaccinationCursor.tenantId!=='string'||typeof vaccinationCursor.vaccinationId!=='string'||vaccinationCursor.tenantId.length>191||vaccinationCursor.vaccinationId.length>191))return NextResponse.json({error:'Invalid vaccination cursor.'},{status:400});
  const prepaidCursor=body.prepaidCursor;if(prepaidCursor!=null&&(typeof prepaidCursor.tenantId!=='string'||typeof prepaidCursor.entryKey!=='string'||prepaidCursor.tenantId.length>191||prepaidCursor.entryKey.length>191))return NextResponse.json({error:'Invalid prepaid cursor.'},{status:400});
  const birthdayCursor=body.birthdayCursor;if(birthdayCursor!=null&&(typeof birthdayCursor.tenantId!=='string'||typeof birthdayCursor.customerId!=='string'||birthdayCursor.tenantId.length>191||birthdayCursor.customerId.length>191))return NextResponse.json({error:'Invalid birthday cursor.'},{status:400});
  const customRuleCursor=body.customRuleCursor;if(customRuleCursor!=null&&(typeof customRuleCursor.tenantId!=='string'||typeof customRuleCursor.auditId!=='string'||customRuleCursor.tenantId.length>191||customRuleCursor.auditId.length>191||(customRuleCursor.retentionTicketId!==undefined&&(typeof customRuleCursor.retentionTicketId!=='string'||customRuleCursor.retentionTicketId.length>191))||(customRuleCursor.balanceKey!==undefined&&(typeof customRuleCursor.balanceKey!=='string'||customRuleCursor.balanceKey.length>191))||(customRuleCursor.bookingKey!==undefined&&(typeof customRuleCursor.bookingKey!=='string'||customRuleCursor.bookingKey.length>191))||(customRuleCursor.taskKey!==undefined&&(typeof customRuleCursor.taskKey!=='string'||customRuleCursor.taskKey.length>191))))return NextResponse.json({error:'Invalid rule cursor.'},{status:400});
  const conversationCursor=body.conversationCursor;if(conversationCursor!=null&&(typeof conversationCursor!=='string'||conversationCursor.length>191))return NextResponse.json({error:'Invalid conversation cursor.'},{status:400});
  const [messages,waitlist,vaccinations,prepaid,birthdays,customRules,conversations]=await Promise.all([body.messageDone?Promise.resolve({cursor:null}):runAppointmentMessages(cursor||null),body.waitlistDone?Promise.resolve({cursor:null}):runWaitlistMatches(waitlistCursor||null),body.vaccinationDone?Promise.resolve({cursor:null}):runVaccinationReminders(vaccinationCursor||null),body.prepaidDone?Promise.resolve({cursor:null}):runPrepaidReminders(prepaidCursor||null),body.birthdayDone?Promise.resolve({cursor:null}):runBirthdayMessages(birthdayCursor||null),body.customRuleDone?Promise.resolve({cursor:null}):runCustomStaffRules(customRuleCursor||null),body.conversationDone?Promise.resolve({cursor:null}):runConversationTenant(db,conversationCursor||null)]);
  return NextResponse.json({cursor:messages.cursor,waitlistCursor:waitlist.cursor,vaccinationCursor:vaccinations.cursor,prepaidCursor:prepaid.cursor,birthdayCursor:birthdays.cursor,customRuleCursor:customRules.cursor,conversationCursor:conversations.cursor},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Appointment scheduler check failed.'},{status:503});}
}
