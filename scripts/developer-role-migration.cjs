const existing="enum('ADMIN','MANAGER','FLOOR_MANAGER','FRONT','BACK','MASTER_GROOMER','GROOMER','SALES')";
async function migrateDeveloperRole(db){
  for(const table of ['User','RolePermission']){
    const rows=await db.$queryRawUnsafe("SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='role'",table);
    const type=rows[0]?.columnType;
    if(!type)throw Error('Missing access-role column.');
    if(type.includes("'DEVELOPER'"))continue;
    if(type!==existing)throw Error('Unexpected access-role enum; migration review required.');
    await db.$executeRawUnsafe('ALTER TABLE `'+table+'` MODIFY COLUMN `role` '+type.slice(0,-1)+",'DEVELOPER') NOT NULL"+(table==='User'?" DEFAULT 'FRONT'":""));
  }
}
module.exports={migrateDeveloperRole};
