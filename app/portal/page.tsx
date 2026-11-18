import {CustomerPortal} from '@/src/components/customer-portal';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{tenant?:string;location?:string}>}){const q=await searchParams;return <CustomerPortal tenant={q.tenant||''} location={q.location||''}/>;}
