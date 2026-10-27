import {NextRequest,NextResponse} from 'next/server';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {zipSync} from 'fflate';
import {platformSession,isPlatformAdmin} from '@/src/lib/platform-access';
export const runtime='nodejs';
const files=['Setup-Connector.cmd','Setup-Connector.ps1','Start-Connector.cmd','Run-ConfiguredConnector.ps1','Start-Connector.ps1','Inspect-123Pet.ps1','Read-TicketBundles.ps1','Invoke-VerifiedWrite.ps1','Receive-DemoSnapshot.ps1','README.md'];
export async function GET(r:NextRequest){
 const actor=await platformSession(r);
 if(!actor)return NextResponse.json({error:'Employee PIN is required.'},{status:401});
 if(!isPlatformAdmin(actor))return NextResponse.json({error:'Owner or Developer access is required.'},{status:403});
 const entries=await Promise.all(files.map(async name=>[name,new Uint8Array(await readFile(join(process.cwd(),'connectors','123pet',name)))] as const));
 return new NextResponse(new Uint8Array(zipSync(Object.fromEntries(entries))),{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="GroomPro-123Pet-Connector.zip"','Cache-Control':'no-store'}});
}
