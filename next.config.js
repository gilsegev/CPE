/** @type {import('next').NextConfig} */
const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL || 'https://directus-production-69c0.up.railway.app';
const directusHost = new URL(directusUrl).hostname;

const nextConfig = {
  images: {
    domains: [
      "utfs.io",
      directusHost
    ]
  },
  experimental: {
    serverActions: true,
  }
}

module.exports = nextConfig
