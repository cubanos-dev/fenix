import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // bun:sqlite is a Bun-only built-in; mark it external so Next doesn't try
  // to bundle it for server components.
  serverExternalPackages: ['bun:sqlite'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig
