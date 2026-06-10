/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "utfs.io",
      "directus-production-69c0.up.railway.app"
    ]
  },
  experimental: {
    serverActions: true,
  }
}

module.exports = nextConfig
