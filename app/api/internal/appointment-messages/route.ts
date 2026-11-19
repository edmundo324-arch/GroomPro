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
  return NextResponse.json(await runAppointmentMessages(cursor||null),{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Appointment scheduler check failed.'},{status:503});}
}
