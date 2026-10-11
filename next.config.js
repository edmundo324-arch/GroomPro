/** @type {import('next').NextConfig} */
const path = require('node:path');

module.exports = {
  distDir: process.env.GROOMPRO_BUILD_DIR || ".next",
  experimental: { cpus: 2 },
  webpack: (config) => {
    if (process.platform === "win32") { config.parallelism = 1; config.cache = false; }
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname),
      '@/src': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};
