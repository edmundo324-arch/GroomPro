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

function prismaPush() {
  const prismaBin = require.resolve('prisma/build/index.js');
  const result = spawnSync(process.execPath, [prismaBin, 'db', 'push', '--accept-data-loss', '--skip-generate'], { encoding: 'utf8', env: process.env });
  if (result.status !== 0) throw new Error(`Unable to create GroomPro core tables: ${result.stderr || result.stdout}`);
  console.log('GroomPro: core Prisma tables are ready.');
}

async function applyFoundation(connection) {
  const files = [
    'prisma/migrations/20260908_pricing_history/migration.sql',
    'prisma/migrations/20260913_booking_assets/migration.sql',
    'prisma/migrations/20260914_employee_schedules/migration.sql',
  ];
  await connection.query('SET FOREIGN_KEY_CHECKS=0');
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((x) => x.trim()).filter(Boolean)) await connection.query(statement);
    }
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
  }
}

async function main() {
  process.env.DATABASE_URL = process.env.DATABASE_URL || `mysql://${encodeURIComponent(process.env.DB_USER || '')}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST || ''}:${process.env.DB_PORT || '3306'}/${encodeURIComponent(process.env.DB_NAME || '')}`;
  databaseConfig();
  prismaPush();
  const connection = await mysql.createConnection(databaseConfig());
  try {
    await applyFoundation(connection);
    console.log('GroomPro: GoDaddy database bootstrap complete.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
