const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const mysql = require('mysql2/promise');

function databaseConfig() {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((key) => process.env[key] === undefined || process.env[key] === '');
  if (missing.length) throw new Error(`GoDaddy database configuration is missing: ${missing.join(', ')}.`);
  return { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || '3306'), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME };
}

function baselineSql() {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Unable to generate database schema: ${result.stderr || result.stdout}`);
  return result.stdout;
}

function rawFoundationSql() {
  const files = [
    'prisma/migrations/20260908_pricing_history/migration.sql',
    'prisma/migrations/20260913_booking_assets/migration.sql',
    'prisma/migrations/20260914_employee_schedules/migration.sql',
  ];
  return files.map((file) => `\n-- ${file}\n${fs.readFileSync(path.join(process.cwd(), file), 'utf8')}`).join('\n');
}

async function main() {
  const connection = await mysql.createConnection(databaseConfig());
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    const sql = `${baselineSql()}\n${rawFoundationSql()}`;
    for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((x) => x.trim()).filter(Boolean)) await connection.query(statement);
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
    console.log('GroomPro: GoDaddy database schema is ready.');
  } finally { await connection.end(); }
}

main().catch((error) => { console.error(error); process.exit(1); });
