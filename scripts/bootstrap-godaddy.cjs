const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { ROOT, loadEnvironment, databaseUrl } = require('./database-config.cjs');
function statements(sql) {
  return sql.replace(/^--.*$/gm, '').split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
}
function schemaPlan(sql) {
  const all = statements(sql);
  const tables = all.filter(s => /^CREATE TABLE/i.test(s)).map(statement => {
    const name = statement.match(/^CREATE TABLE(?: IF NOT EXISTS)? `([^`]+)`/)[1];
    const columns = [...statement.matchAll(/^\s*`([^`]+)` (.+?)(?:,)?$/gm)]
      .map(([, name, definition]) => ({ name, definition: definition.replace(/,$/, '') }));
    return { name, statement, columns };
  });
  if (!tables.length || new Set(tables.map(t => t.name)).size !== tables.length) throw new Error('Invalid schema bundle.');
  return { all, tables };
}
async function verify(db, plan) {
  const rows = await db.$queryRaw`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()`;
  const present = new Set(rows.map(r => `${r.tableName}.${r.columnName}`));
  const missing = plan.tables.flatMap(t => t.columns.filter(c => !present.has(`${t.name}.${c.name}`)).map(c => `${t.name}.${c.name}`));
  if (missing.length) throw new Error(`Database schema is incomplete: ${missing.join(', ')}`);
  const status = await db.$queryRaw`SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Ticket' AND COLUMN_NAME='status'`;
  if (!status[0]?.columnType.includes("'NO_SHOW'")) throw new Error('Ticket.status requires a reviewed migration to include NO_SHOW.');
  for (const t of plan.tables) await db.$queryRawUnsafe(`SELECT ${t.columns.map(c => `\`${c.name}\``).join(',')} FROM \`${t.name}\` LIMIT 0`);
  return plan.tables.length;
}
async function bootstrap(db, plan) {
  // Pin the advisory lock to one connection. DDL autocommits in MySQL;
  // metadata checks let a repeat run resume a partially completed bootstrap.
  return db.$transaction(async tx => {
    const lock = await tx.$queryRaw`SELECT GET_LOCK(CONCAT('groompro:', LEFT(SHA2(DATABASE(), 256), 48)), 60) AS acquired`;
    if (Number(lock[0]?.acquired) !== 1) throw new Error('Another database bootstrap is still running.');
    try {
      for (const table of plan.tables) {
        await tx.$executeRawUnsafe(table.statement.replace(/^CREATE TABLE(?: IF NOT EXISTS)?/, 'CREATE TABLE IF NOT EXISTS'));
        const columns = await tx.$queryRaw`SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table.name}`;
        const names = new Set(columns.map(c => c.name));
        for (const c of table.columns) {
          if (!names.has(c.name)) await tx.$executeRawUnsafe(`ALTER TABLE \`${table.name}\` ADD COLUMN \`${c.name}\` ${c.definition}`);
        }
      }
      for (const statement of plan.all.filter(s => /^ALTER TABLE/i.test(s))) {
        const match = statement.match(/^ALTER TABLE `([^`]+)` ADD CONSTRAINT `([^`]+)`/);
        if (!match) throw new Error('Unsupported schema statement; review the generated bundle.');
        const existing = await tx.$queryRaw`SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=${match[1]} AND CONSTRAINT_NAME=${match[2]}`;
        if (!existing.length) await tx.$executeRawUnsafe(statement);
      }
      for (const statement of plan.all.filter(s => /^INSERT IGNORE INTO FeatureModule/i.test(s))) await tx.$executeRawUnsafe(statement);
      // The previous bootstrap created this exact enum before failing on jobTitle.
      // Append the new value without changing any existing value or ordinal.
      const status = await tx.$queryRaw`SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Ticket' AND COLUMN_NAME='status'`;
      if (status[0]?.columnType === "enum('OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED','CANCELLED')") {
        await tx.$executeRawUnsafe("ALTER TABLE `Ticket` MODIFY COLUMN `status` ENUM('OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED','CANCELLED','NO_SHOW') NOT NULL DEFAULT 'OPEN'");
      }
      return await verify(tx, plan);
    } finally {
      await tx.$queryRaw`SELECT RELEASE_LOCK(CONCAT('groompro:', LEFT(SHA2(DATABASE(), 256), 48))) AS released`;
    }
  }, { maxWait: 65000, timeout: 240000 });
}
async function main() {
  loadEnvironment();
  console.log('GroomPro: starting schema bootstrap v2 (47-table recovery).');
  process.env.DATABASE_URL = databaseUrl();
  const filename = path.join(ROOT, 'godaddy-groompro-schema.sql');
  const sql = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : require('./build-godaddy-schema-sql.cjs').buildSchema();
  const plan = schemaPlan(sql);
  const db = new PrismaClient();
  try {
    const count = process.argv.includes('--verify-only') ? await verify(db, plan) : await bootstrap(db, plan);
    console.log(`GroomPro: verified ${count} application tables and all required columns.`);
  } finally { await db.$disconnect(); }
}
if (require.main === module) main().catch(error => {
  console.error('GroomPro database bootstrap failed:', error.code || error.name, String(error.message).replace(/mysql:\/\/[^\s"']+/g, 'mysql://[redacted]'));
  process.exitCode = 1;
});
module.exports = { statements, schemaPlan, verify, bootstrap };
