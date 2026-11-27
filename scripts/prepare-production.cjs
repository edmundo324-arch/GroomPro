const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT } = require('./database-config.cjs');

function built() {
  const directory = path.resolve(ROOT, process.env.GROOMPRO_BUILD_DIR || '.next');
  return ['BUILD_ID', 'routes-manifest.json', 'required-server-files.json', 'server/pages-manifest.json']
    .every(file => fs.existsSync(path.join(directory, file)));
}

// GoDaddy may start the app while its separate setup process is still installing.
async function waitForInstall() {
  const deadline = Date.now() + 120000;
  let waiting = false;
  for (;;) {
    try {
      for (const name of ['@next/env', 'next/dist/bin/next', '@prisma/client', '.prisma/client/default']) require.resolve(name);
      return;
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND' || Date.now() >= deadline) throw error;
      if (!waiting) console.log('GroomPro: waiting for the hosting installation to finish.');
      waiting = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function prepareBuild(force = false) {
  // An OS-owned lock disappears if a build is stopped. Separate checkouts do not share it.
  const net = require('node:net');
  const key = require('node:crypto').createHash('sha256').update(ROOT).digest('hex').slice(0, 24);
  const socket = process.platform === 'win32' ? '\\\\.\\pipe\\groompro-' + key :
    process.platform === 'linux' ? '\0groompro-' + key : path.join(require('node:os').tmpdir(), 'groompro-' + key + '.sock');
  const lock = net.createServer(connection => connection.end());
  let waited = false;
  for (;;) {
    try {
      await new Promise((resolve, reject) => {
        function failed(error) {
          lock.removeListener('listening', acquired);
          reject(error);
        }
        function acquired() {
          lock.removeListener('error', failed);
          resolve();
        }
        lock.once('error', failed);
        lock.once('listening', acquired);
        lock.listen(socket);
      });
      break;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      if (!waited) console.log('GroomPro: waiting for the production build already in progress.');
      waited = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  try {
    if ((!force || waited) && built()) return;
    console.log('GroomPro: preparing the production site before opening it.');
    // The explicit hosting build repairs dependencies. A startup recovery uses the host installation.
    if (force) run([process.env.npm_execpath, 'ci', '--include=dev', '--no-audit', '--no-fund']);
    else await waitForInstall();
    run([require.resolve('prisma/build/index.js'), 'generate']);
    run([require.resolve('./build-godaddy-schema-sql.cjs')]);
    run([require.resolve('next/dist/bin/next'), 'build']);
    if (!built()) throw Error('GroomPro could not find the finished production site.');
  } finally {
    await new Promise(resolve => lock.close(resolve));
  }
}

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: ROOT, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('GroomPro production preparation failed. See the preceding build output.');
}

if (require.main === module) prepareBuild(process.argv.includes('--rebuild')).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
module.exports = { waitForInstall, prepareBuild, built };
