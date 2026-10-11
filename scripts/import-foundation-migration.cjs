const {createHash}=require('node:crypto');
const version='20261011_import_foundation_v1';
const columns={Customer:['notes','popupNotes','historyNotes','documentFolder'],Pet:['notes','groomingNotes','medicalNotes','behaviorNotes','vipEligibilityNotes','kennelNotes']};
const checksum=createHash('sha256').update(JSON.stringify(columns)).digest('hex');
async function migrateImportFoundation(db){
 await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS `GroomProSchemaVersion` (`version` VARCHAR(191) PRIMARY KEY, `checksum` VARCHAR(64) NOT NULL, `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))');
 const found=await db.$queryRaw`SELECT checksum FROM GroomProSchemaVersion WHERE version=${version}`;
 if(found.length&&found[0].checksum!==checksum)throw Error('Import foundation migration checksum mismatch.');
 for(const [table,names] of Object.entries(columns))for(const name of names){const row=await db.$queryRaw`SELECT DATA_TYPE AS dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} AND COLUMN_NAME=${name}`;if(!row.length)throw Error('Import foundation column missing. Run schema bootstrap first.');if(row[0].dataType!=='longtext')await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${name}\` LONGTEXT NULL`);}
 if(!found.length)await db.$executeRaw`INSERT INTO GroomProSchemaVersion (version,checksum) VALUES (${version},${checksum})`;
}
module.exports={migrateImportFoundation,version,checksum};
