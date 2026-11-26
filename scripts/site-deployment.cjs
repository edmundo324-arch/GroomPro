// An unset role preserves the existing installation. Each other role is a separate deployment.
const roles = ['current', 'sales', 'admin', 'development', 'staging', 'tenant'];
function siteRole(env = process.env) {
  const role = env.GROOMPRO_SITE_ROLE || 'current';
  if (!roles.includes(role)) throw Error('Choose a valid GroomPro site role.');
  return role;
}
function isTestSite(env = process.env) { return ['development', 'staging'].includes(siteRole(env)); }
function siteHosts(env = process.env) {
  const hosts = (env.GROOMPRO_SITE_HOSTS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!hosts.length || hosts.some(h => !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(h))) throw Error('Configure the exact addresses for this site.');
  return hosts;
}
function allowsHost(host, env = process.env) {
  if (siteRole(env) === 'current') return true;
  return siteHosts(env).includes(String(host || '').toLowerCase().replace(/:\d+$/, '').replace(/\.$/, ''));
}
function validateDatabase(value, env = process.env) {
  const role = siteRole(env);
  if (role === 'sales') throw Error('The sales site must not connect to a business database.');
  if (!isTestSite(env)) return;
  const name = decodeURIComponent(new URL(value).pathname.slice(1)).toLowerCase();
  const liveName = (env.GROOMPRO_LIVE_DATABASE_NAME || '').toLowerCase();
  if (!liveName || name === liveName || !name.endsWith('_' + role)) throw Error('Use a separate ' + role + ' database ending in _' + role + ', and identify the live database before starting.');
}
function validateDeployment(env = process.env) {
  const role = siteRole(env);
  if (role === 'current') return;
  siteHosts(env);
  if (['sales','admin','development','staging'].includes(role) && env.GROOMPRO_SUBDOMAIN_ROUTING_ENABLED === 'true') throw Error('Business subdomain routing belongs on the tenant deployment only.');
  if (role === 'sales' && (env.DATABASE_URL || env.DB_HOST)) throw Error('Remove database credentials from the sales deployment.');
}
function runsSchedulers(env = process.env) { return ['current', 'tenant'].includes(siteRole(env)); }
module.exports = { siteRole, isTestSite, siteHosts, allowsHost, validateDatabase, validateDeployment, runsSchedulers };
