import {NextRequest,NextResponse} from 'next/server';
import {getActiveEmployeeSession} from './employee-session';
export async function authorizeSchedule(r:NextRequest,tenantId:string){const sid=r.cookies.get("groompro_session")?.value;const session=sid?await getActiveEmployeeSession(tenantId,sid):null;if(!session)return NextResponse.json({error:"Employee PIN is required."},{status:401});if(!['PLATFORM_OWNER','DEVELOPER','ADMIN','MANAGER',"FLOOR_MANAGER"].includes(session.user.role))return NextResponse.json({error:"A manager must sign in to edit schedules."},{status:403});return null;}
