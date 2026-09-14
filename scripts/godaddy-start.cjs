const { spawn } = require("node:child_process");

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Database configuration is missing: ${missing.join(", ")}.`);
  return `mysql://${encodeURIComponent(process.env.DB_USER)}:${encodeURIComponent(process.env.DB_PASSWORD)}@${process.env.DB_HOST}:${process.env.DB_PORT || "3306"}/${encodeURIComponent(process.env.DB_NAME)}`;
}

process.env.DATABASE_URL=buildDatabaseUrl();
const nextBin=require.resolve("next/dist/bin/next");
const bootstrapBin=require.resolve("./bootstrap-godaddy.cjs");
const next=spawn(process.execPath,[nextBin,"start","-p",process.env.PORT||"3000"],{stdio:"inherit",env:process.env});
const bootstrap=spawn(process.execPath,[bootstrapBin],{stdio:"inherit",env:process.env});
bootstrap.on("exit",c=>console.log(`GroomPro: database bootstrap ${c===0?"complete":"exited with code "+c}.`));
next.on("exit",(code,signal)=>{if(bootstrap.exitCode===null)bootstrap.kill("SIGTERM");if(signal)process.kill(process.pid,signal);process.exit(code??1)});
for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>{if(next.exitCode===null)next.kill(signal);if(bootstrap.exitCode===null)bootstrap.kill(signal)});
