const {createHash}=require('node:crypto');
const version='20261025_company_owners_v1';
const checksum=createHash('sha256').update(version+':Edmundo and Zagla Saenz/Saens/S to PLATFORM_OWNER once').digest('hex');

async function migrateOwnerRole(db){
 for(const table of ['User','RolePermission']){
  const rows=await db.$queryRawUnsafe("SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='role'",table);
  const type=rows[0]?.columnType;
  if(!type||!type.startsWith('enum(')||!type.includes("'DEVELOPER'"))throw Error('Developer role migration must run before Platform Owner.');
  if(type.includes("'PLATFORM_OWNER'"))continue;
  await db.$executeRawUnsafe('ALTER TABLE `'+table+'` MODIFY COLUMN `role` '+type.slice(0,-1)+",'PLATFORM_OWNER') NOT NULL"+(table==='User'?" DEFAULT 'FRONT'":""));
 }
}

function isCompanyOwner(user){
 const first=String(user.firstName||'').trim().toLowerCase();
 const last=String(user.lastName||'').trim().toLowerCase().replace(/\.$/,'');
 return ['edmundo','zagla'].includes(first)&&['saenz','saens','s'].includes(last);
}

// Existing development accounts only. Never infer platform authority for future
// customers from their names, their job titles, or a tenant Admin role.
async function promoteCompanyOwners(db){
 const applied=await db.$queryRaw`SELECT checksum FROM GroomProSchemaVersion WHERE version=${version}`;
 if(applied.length){if(applied[0].checksum!==checksum)throw Error('Company owner migration checksum mismatch.');return 0;}
 const users=await db.user.findMany({select:{id:true,tenantId:true,firstName:true,lastName:true,role:true}});
 let count=0;
 for(const user of users.filter(isCompanyOwner)){
  if(user.role==='PLATFORM_OWNER')continue;
  await db.user.update({where:{id:user.id},data:{role:'PLATFORM_OWNER'}});
  await db.auditEntry.create({data:{tenantId:user.tenantId,actorType:'SYSTEM',entityType:'USER',entityId:user.id,action:'PLATFORM_OWNER_GRANTED',summary:'Assigned GroomPro company Owner authority.',details:{migration:version,previousRole:user.role,newRole:'PLATFORM_OWNER'}}});
  count++;
 }
 await db.$executeRaw`INSERT INTO GroomProSchemaVersion (version,checksum) VALUES (${version},${checksum})`;
 console.log(`GroomPro: assigned Platform Owner to ${count} existing company owner account(s).`);
 return count;
}
module.exports={migrateOwnerRole,promoteCompanyOwners,isCompanyOwner};
