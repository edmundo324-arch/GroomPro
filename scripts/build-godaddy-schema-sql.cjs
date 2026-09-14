const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const prismaBin=require.resolve('prisma/build/index.js');
const result=spawnSync(process.execPath,[prismaBin,'migrate','diff','--from-empty','--to-schema-datamodel','prisma/schema.prisma','--script'],{encoding:'utf8'});
if(result.status!==0)throw new Error(`Unable to generate core schema: ${result.stderr||result.stdout}`);
const foundation=['prisma/migrations/20260908_pricing_history/migration.sql','prisma/migrations/20260913_booking_assets/migration.sql','prisma/migrations/20260914_employee_schedules/migration.sql'];
let out='-- GroomPro schema bundle for GoDaddy Hosted Database\n-- Core tables are generated from prisma/schema.prisma.\n-- Additional non-Prisma tables are included below.\nSET FOREIGN_KEY_CHECKS=0;\n\n'+result.stdout+'\n';
for(const file of foundation){const full=path.join(process.cwd(),file);if(fs.existsSync(full))out+=`\n-- ${file}\n${fs.readFileSync(full,'utf8')}\n`;}
out+='\nSET FOREIGN_KEY_CHECKS=1;\n';
fs.writeFileSync(path.join(process.cwd(),'godaddy-groompro-schema.sql'),out);
console.log('Created godaddy-groompro-schema.sql');
