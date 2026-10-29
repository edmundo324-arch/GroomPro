/** @type {import('next').NextConfig} */
const path = require('node:path');

module.exports = (phase) => ({
  // Keep a running development preview out of production build artifacts.
  distDir: process.env.GROOMPRO_BUILD_DIR || (phase === "phase-development-server" ? ".next-dev" : ".next"),
  experimental: { cpus: 2 },
  outputFileTracingIncludes: { '/api/integrations/123pet/download': ['./connectors/123pet/*.ps1','./connectors/123pet/*.cmd','./connectors/123pet/README.md'], '/api/setup/prepared-data': ['./transfer-data/GroomPro-Full-Customer-and-Ticket-History.zip','./transfer-data/GroomPro-Local-Services.json'] },
  onDemandEntries: { maxInactiveAge: 600000, pagesBufferLength: 100 },
  webpack: (config, { dev }) => {
    // Hosted syncs can restore incompatible filesystem snapshots; do not reuse them.
    config.cache = dev ? { type: 'memory' } : false;
    if (process.platform === "win32") config.parallelism = 1;
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname),
      '@/src': path.resolve(__dirname, 'src'),
    };
    return config;
  },
});
