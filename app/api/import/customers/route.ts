import {withRequestPolicy} from '@/src/lib/request-policy';
import {NextResponse} from 'next/server';
async function handlePolicyPOST(){return NextResponse.json({error:'Use Settings → Data import and migration to stage, map, validate and import every source field safely.'},{status:410});}

export const POST=withRequestPolicy(handlePolicyPOST, {});
