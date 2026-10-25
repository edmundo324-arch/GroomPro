import {withRequestPolicy} from '@/src/lib/request-policy';
import { NextRequest, NextResponse } from "next/server";
import { searchCustomers } from "@/src/lib/customer";
async function handlePolicyGET(request:NextRequest){const tenantId=request.headers.get("x-tenant-id")||process.env.GROOMPRO_DEV_TENANT_ID;const query=request.nextUrl.searchParams.get("q")||"";if(!tenantId)return NextResponse.json({error:"Tenant context is required."},{status:401});if(query.trim().length<2)return NextResponse.json({customers:[]});try{return NextResponse.json({customers:await searchCustomers(tenantId,query)})}catch{return NextResponse.json({error:"Customer search could not be completed."},{status:500})}}

export const GET=withRequestPolicy(handlePolicyGET, {feature:'CUSTOMERS'});
