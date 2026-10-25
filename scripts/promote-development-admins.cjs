const {createHash}=require('node:crypto');
const version='20261025_existing_development_admins_v1';
const checksum=createHash('sha256').update(version+':existing ADMIN to DEVELOPER once').digest('hex');

// Runs under bootstrap's database lock and transaction, after the schema migration.
// Record completion even on an empty installation: later tenant Admins stay Admins.
async function promoteDevelopmentAdmins(db){
 const applied=await db.$queryRaw`SELECT checksum FROM GroomProSchemaVersion WHERE version=${version}`;
 if(applied.length){
  if(applied[0].checksum!==checksum)throw Error('Development administrator migration checksum mismatch.');
  return 0;
 }
 const admins=await db.user.findMany({where:{role:'ADMIN'},select:{id:true,tenantId:true}});
 let count=0;
 for(const admin of admins){
  const changed=await db.user.updateMany({where:{id:admin.id,tenantId:admin.tenantId,role:'ADMIN'},data:{role:'DEVELOPER'}});
  if(!changed.count)continue;
  await db.auditEntry.create({data:{tenantId:admin.tenantId,actorType:'SYSTEM',entityType:'USER',entityId:admin.id,action:'DEVELOPER_ROLE_GRANTED',summary:'Converted existing development Admin to Developer as requested by the GroomPro owner.',details:{migration:version,previousRole:'ADMIN',newRole:'DEVELOPER'}}});
  count++;
 }
 await db.$executeRaw`INSERT INTO GroomProSchemaVersion (version,checksum) VALUES (${version},${checksum})`;
 return count;
}
module.exports={promoteDevelopmentAdmins};
