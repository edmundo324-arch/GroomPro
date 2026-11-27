import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {platformSession} from '@/src/lib/platform-access';
import {withRequestPolicy} from '@/src/lib/request-policy';
import {configured,canConnect,connection,connect,disconnect,pickerScope,protect,openProtected} from '@/src/lib/google-photos';

const cookie='gp_google_photos_state';
const sessionKey=(r:NextRequest)=>createHash('sha256').update(r.cookies.get('groompro_session')?.value||'').digest('hex');
async function handle(r:NextRequest) {
  const session=await platformSession(r);
  if(!session)return NextResponse.json({error:'Sign in to GroomPro first.'},{status:401});
  const tenant=session.tenantId,manager=canConnect(session.user.role);
  const callback=r.method==='GET'&&r.nextUrl.searchParams.has('state');
  try {
    if(r.method==='GET'&&!callback)return NextResponse.json({configured:configured(),connected:!!await connection(tenant),manager},{headers:{'Cache-Control':'no-store'}});
    if(!manager)return NextResponse.json({error:'Ask a business administrator to connect Google Photos.'},{status:403});
    if(callback){
      const state=r.nextUrl.searchParams.get('state')!;
      if(state!==r.cookies.get(cookie)?.value || openProtected(tenant,'oauth',state).session!==sessionKey(r))throw Error('Return to the gallery and start the connection again.');
      const code=r.nextUrl.searchParams.get('code');
      if(!code)throw Error('Google Photos was not connected. You can close this tab.');
      await connect(tenant,code);
      const response=new NextResponse('Google Photos is connected. Close this tab and choose Add From Google Photos in the pet gallery.',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
      response.cookies.delete(cookie);return response;
    }
    if(r.method==='DELETE'){await disconnect(tenant);return NextResponse.json({ok:true});}
    const state=protect(tenant,'oauth',{session:sessionKey(r),expires:Date.now()+600000});
    const params=new URLSearchParams({client_id:process.env.GOOGLE_PHOTOS_CLIENT_ID!,redirect_uri:process.env.GOOGLE_PHOTOS_REDIRECT_URI!,response_type:'code',scope:pickerScope,state,access_type:'offline',prompt:'select_account consent'});
    const response=NextResponse.json({url:'https://accounts.google.com/o/oauth2/v2/auth?'+params});
    response.cookies.set(cookie,state,{httpOnly:true,sameSite:'lax',secure:r.nextUrl.protocol==='https:',path:'/',maxAge:600});
    return response;
  } catch(e) {
    const error=(e as Error).message;
    return callback?new NextResponse(error,{status:400,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}}):NextResponse.json({error},{status:400});
  }
}
export const GET=withRequestPolicy(handle,{feature:'PETS'});
export const POST=withRequestPolicy(handle,{feature:'PETS',configure:true});
export const DELETE=withRequestPolicy(handle,{feature:'PETS',configure:true});
