const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
function loadEnvironment() { require('@next/env').loadEnvConfig(ROOT, process.env.NODE_ENV !== 'production'); }
function databaseUrl(env = process.env) {
  let value = env.DATABASE_URL;
  if (!value) {
    const missing = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].filter(key => !env[key]);
    if (missing.length) throw new Error(`Database configuration is missing: ${missing.join(', ')}.`);
    const host = env.DB_HOST.includes(':') && !env.DB_HOST.startsWith('[') ? `[${env.DB_HOST}]` : env.DB_HOST;
    value = `mysql://${encodeURIComponent(env.DB_USER)}:${encodeURIComponent(env.DB_PASSWORD)}@${host}:${env.DB_PORT || '3306'}/${encodeURIComponent(env.DB_NAME)}`;
  }
  let url;
  try { url = new URL(value); } catch { throw new Error('DATABASE_URL must be a valid MySQL URL.'); }
  if (url.protocol !== 'mysql:' || !url.hostname || !url.username || !url.pathname.slice(1)) throw new Error('DATABASE_URL must specify a MySQL host, user, and database.');
  if (url.port && (Number(url.port) < 1 || Number(url.port) > 65535)) throw new Error('Invalid MySQL port.');
  return value;
}
module.exports = { ROOT, loadEnvironment, databaseUrl };
