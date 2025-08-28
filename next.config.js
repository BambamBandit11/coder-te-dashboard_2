/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    RAMP_CLIENT_ID: process.env.RAMP_CLIENT_ID,
    RAMP_CLIENT_SECRET: process.env.RAMP_CLIENT_SECRET,
    RAMP_ENVIRONMENT: process.env.RAMP_ENVIRONMENT || 'production'
  }
}

module.exports = nextConfig
