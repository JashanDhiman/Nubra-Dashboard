/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ["ws"] },
  env: {
    NUBRA_API_KEY: process.env.NUBRA_API_KEY,
    NUBRA_MPIN: process.env.NUBRA_MPIN,
    NUBRA_BASE_URL: process.env.NUBRA_BASE_URL,
    NUBRA_WS_URL: process.env.NUBRA_WS_URL,
  },
};
module.exports = nextConfig;
