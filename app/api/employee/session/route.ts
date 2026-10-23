import {randomBytes} from 'node:crypto';
import {writeAudit} from '@/src/lib/audit';
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { verifyPin, hashPinPrefixes } from "@/src/lib/pin";
import { createDeviceId, endEmployeeSession, getActiveEmployeeSession, startEmployeeSession } from "@/src/lib/employee-session";

import {allowPinAttempt} from "@/src/lib/pin-attempts";

const SESSION_COOKIE = "groompro_session";
const DEVICE_COOKIE = "groompro_device";

function tenantFrom(request: NextRequest) {
  return request.headers.get("x-tenant-id") || process.env.GROOMPRO_DEV_TENANT_ID || "";
}

async function getContext(request: NextRequest) {
  const tenantId = tenantFrom(request);
  const deviceId = request.cookies.get(DEVICE_COOKIE)?.value || createDeviceId();
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value || "";
  return { tenantId, deviceId, sessionId };
}

export async function GET(request: NextRequest) {
  const { tenantId, sessionId } = await getContext(request);
  if (!tenantId || !sessionId) return NextResponse.json({ employee: null });

  const session = await getActiveEmployeeSession(tenantId, sessionId);
  if (!session) return NextResponse.json({ employee: null });

  return NextResponse.json({ employee: { id: session.user.id, displayName: session.user.displayName, firstName: session.user.firstName, lastName: session.user.lastName, role: session.user.role } });
}

export async function POST(request: NextRequest) {
  const { tenantId, deviceId, sessionId } = await getContext(request);
  if (!tenantId) return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });

  let body: { pin?: string; automatic?: boolean; mode?: string; requestHash?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const pin = String(body.pin || "");
  if (!/^\d{3,10}$/.test(pin)) return NextResponse.json({ error: "PIN must contain 3–10 digits." }, { status: 400 });

  if(!await allowPinAttempt(tenantId))return NextResponse.json({error:"Too many PIN attempts. Wait a minute and try again."},{status:429});
  const users = await db.user.findMany({ where: { tenantId, active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  const user = (await Promise.all(users.map(async (candidate) => (await verifyPin(pin, candidate.pinHash)) ? candidate : null))).find(Boolean);
  if (!user) return NextResponse.json({ error: "Employee PIN not recognized." }, { status: 401 });

  if(body.automatic){
    // Old records must be upgraded explicitly; do not recognize a prefix of another PIN.
    if(users.some(candidate=>!Array.isArray(candidate.pinPrefixHashes)))return NextResponse.json({pending:true,message:'An older PIN record needs verification. Press Continue to sign in securely.'},{status:202});
    for(const candidate of users){
      if(candidate.id===user.id)continue;
      if(await verifyPin(pin,candidate.pinHash))return NextResponse.json({pending:true,message:'Press Continue to verify this PIN securely.'},{status:202});
      for(const hash of candidate.pinPrefixHashes as string[])if(await verifyPin(pin,hash))return NextResponse.json({pending:true,message:'Press Continue to verify this PIN securely.'},{status:202});
    }
  }
  if(!Array.isArray(user.pinPrefixHashes))await db.user.updateMany({where:{id:user.id,tenantId,pinHash:user.pinHash},data:{pinPrefixHashes:await hashPinPrefixes(pin)}});
  if(body.mode==='APPROVAL'){
    if(!['ADMIN','MANAGER'].includes(user.role))return NextResponse.json({error:'Enter an administrator or manager PIN.'},{status:403});
    const working=await db.employeeSession.findFirst({where:{id:sessionId,tenantId,deviceId,endedAt:null,user:{active:true}}});
    if(!working || !/^[a-f0-9]{64}$/.test(body.requestHash||''))return NextResponse.json({error:'Your working session changed. Sign in and try the action again.'},{status:401});
    const approval=await db.actionApproval.create({data:{id:randomBytes(32).toString('hex'),tenantId,sessionId,deviceId,approverId:user.id,requestHash:body.requestHash!,expiresAt:new Date(Date.now()+120000)}});
    await writeAudit({tenantId,actorUserId:user.id,entityType:'USER',entityId:working.userId,action:'APPROVE_ACTION',summary:'Approved one protected action without switching the working employee.',details:{workingEmployeeId:working.userId,approvalId:approval.id,requestHash:body.requestHash}});
    return NextResponse.json({approval:approval.id});
  }
  const session = await startEmployeeSession(tenantId, user.id, deviceId);
  const response = NextResponse.json({ employee: { id: user.id, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, role: user.role } });
  response.cookies.set(DEVICE_COOKIE, deviceId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  response.cookies.set(SESSION_COOKIE, session.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}

export async function DELETE(request: NextRequest) {
  const { tenantId, sessionId } = await getContext(request);
  if (tenantId && sessionId) await endEmployeeSession(tenantId, sessionId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
