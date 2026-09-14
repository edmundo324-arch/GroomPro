/** @type {import('next').NextConfig} */
const path = require('node:path');

module.exports = {
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname),
      '@/src': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};
