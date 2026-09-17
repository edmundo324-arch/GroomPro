const { spawn } = require('node:child_process');
const { ROOT, loadEnvironment, databaseUrl } = require('./database-config.cjs');
function main() {
  const development = process.argv.includes('--dev');
  process.env.NODE_ENV = development ? 'development' : 'production';
  loadEnvironment();
  process.env.DATABASE_URL = databaseUrl();
  let child;
  let stopping = false;
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    stopping = true;
    if (child) child.kill(signal);
  });
  function launch(args, done) {
    child = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
    child.on('error', () => { console.error('GroomPro: unable to launch runtime.'); process.exitCode = 1; });
    child.on('exit', (code, signal) => {
      if (stopping || signal) { process.exitCode = 1; return; }
      done(code ?? 1);
    });
  }
  launch([require.resolve('./bootstrap-godaddy.cjs')], code => {
    if (code !== 0) { process.exitCode = code; return; }
    launch([require.resolve('next/dist/bin/next'), development ? 'dev' : 'start', '-H', '0.0.0.0', '-p', process.env.PORT || '3000'], code => { process.exitCode = code; });
  });
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { main };
