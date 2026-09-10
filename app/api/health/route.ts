import {NextResponse} from "next/server";
import {db} from "@/src/lib/db";
export async function GET(){try{await db.$queryRaw`SELECT 1`;return NextResponse.json({ok:true,database:true,timestamp:new Date().toISOString()});}catch(error){return NextResponse.json({ok:false,database:false,error:error instanceof Error?error.message:"Database unavailable"},{status:503});}}
