/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel supports API routes natively - no static export needed
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
