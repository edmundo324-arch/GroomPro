import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/src/lib/db';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {referralRewards,applyReferralReward} from '@/src/lib/referral-rewards';
async function handle(r:NextRequest){const s=await platformSession(r);if(!s)return NextResponse.json({error:'Enter your employee PIN.'},{status:401});try{const b=r.method==='GET'?{ticketId:r.nextUrl.searchParams.get('ticketId')}:await r.json(),ticket=await db.ticket.findFirst({where:{tenantId:s.tenantId,id:String(b.ticketId||'')}});if(!ticket)throw Error('Choose this customer’s ticket.');if(r.method==='GET'){const applied=(await db.tenantSetting.findUnique({where:{tenantId_settingKey:{tenantId:s.tenantId,settingKey:'REFERRAL_REWARD_APPLIED:'+ticket.id}}}))?.value as any;return NextResponse.json({rewards:await referralRewards(db,s.tenantId,ticket.customerId),applied:applied?.items||[]},{headers:{'Cache-Control':'no-store'}});}return NextResponse.json(await applyReferralReward(s.tenantId,s.user.id,ticket.id,String(b.rewardId||''),String(b.lineId||''),b.action==='REMOVE'));}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}}
export const GET=withRequestPolicy(handle,{feature:'TICKETS'});export const POST=withRequestPolicy(handle,{feature:'TICKETS'});
