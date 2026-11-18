import {NextRequest,NextResponse} from 'next/server';
import {approveDevice,deviceApproved,deviceApprovalCookie,sendDeviceCode,verifyDeviceCode,verifyDevicePassword} from '@/src/lib/device-authorization';
import {businessCookie,deviceCookie,sessionCookie,contextCookieOptions} from '@/src/lib/business-context';
import {db} from '@/src/lib/db';
import {currentBusinessSession} from '@/src/lib/platform-business';
import {isPlatformRole} from '@/src/lib/roles';
import {createDeviceId} from '@/src/lib/employee-session';
const headers={'Cache-Control':'no-store'};
export async function GET(r:NextRequest){
 const tenantId=r.cookies.get(businessCookie)?.value||process.env.GROOMPRO_DEV_TENANT_ID||'';
 const deviceId=r.cookies.get(deviceCookie)?.value||'',sessionId=r.cookies.get(sessionCookie)?.value||'';
 const [approved,session]=await Promise.all([deviceApproved(tenantId,deviceId,r.cookies.get(deviceApprovalCookie)?.value||''),tenantId&&sessionId&&deviceId?currentBusinessSession(db,tenantId,sessionId,deviceId):null]);
 // Platform access belongs to the verified session; it does not enroll a tenant device.
 return NextResponse.json({approved,platformAccess:!!session&&isPlatformRole(session.user.role)},{headers});
}
export async function POST(r:NextRequest){
 try{
  const text=await r.text();if(text.length>2048)return NextResponse.json({error:'This request is too large.'},{status:400,headers});
  const b=JSON.parse(text);
  if(b.action==='send')return NextResponse.json({token:await sendDeviceCode(b.email)},{headers});
  if(b.action==='password')return NextResponse.json(await verifyDevicePassword(b.email,String(b.password||'')),{headers});
  if(b.action==='verify')return NextResponse.json({businesses:await verifyDeviceCode(String(b.token||''),String(b.code||''))},{headers});
  if(b.action==='open'){
   const tenantId=String(b.tenantId||''),deviceId=createDeviceId();
   const proof=await approveDevice(String(b.token||''),tenantId,deviceId);
   const response=NextResponse.json({ok:true},{headers}),options={...contextCookieOptions(),maxAge:365*86400};
   response.cookies.set(businessCookie,tenantId,options);response.cookies.set(deviceCookie,deviceId,options);response.cookies.set(deviceApprovalCookie,proof,options);response.cookies.set(sessionCookie,'',{...options,maxAge:0});return response;
  }
  return NextResponse.json({error:'Choose a device verification action.'},{status:400,headers});
 }catch(e){return NextResponse.json({error:e instanceof Error&&e.name==='DeviceAuthorizationError'?e.message:'Device verification could not complete. Try again or contact the Platform Owner.'},{status:400,headers});}
}
