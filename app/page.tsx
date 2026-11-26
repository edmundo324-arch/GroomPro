import GroomProClient from "./groompro-client";
import {siteRole} from '../src/lib/site-deployment';
import {SalesSite} from '../src/components/sales-site';
import {SiteWorkspace} from '../src/components/site-workspace';

// The document must come from the deployment that serves its hashed assets.
export const dynamic = "force-dynamic";

export default function Page() {
  const role=siteRole();
  if(role==='sales')return <SalesSite/>;
  if(['admin','development','staging'].includes(role))return <SiteWorkspace role={role}><GroomProClient/></SiteWorkspace>;
  return <GroomProClient />;
}
