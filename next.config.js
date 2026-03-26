/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['ws'] },
  // Only expose variables that are needed in the frontend
  env: {
    NUBRA_BASE_URL: process.env.NUBRA_BASE_URL,
    NUBRA_WS_URL: process.env.NUBRA_WS_URL,
    NUBRA_DEVICE_ID: process.env.NUBRA_DEVICE_ID,
  },
};

module.exports = nextConfig;
