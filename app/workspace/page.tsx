import {notFound} from 'next/navigation';
import {siteRole} from '../../src/lib/site-deployment';
import GroomProClient from '../groompro-client';
export const dynamic='force-dynamic';
export default function Workspace(){if(siteRole()!=='admin')notFound();return <><div className="gp-site-banner"><a href="/">Back to Master Administration</a><span>Authorized Business Support</span></div><GroomProClient/></>}
