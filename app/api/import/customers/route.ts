import {NextResponse} from 'next/server';
export async function POST(){return NextResponse.json({error:'Use Settings → Data import and migration to stage, map, validate and import every source field safely.'},{status:410});}
