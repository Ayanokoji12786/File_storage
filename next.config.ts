import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // A parent lockfile exists at ~/package-lock.json, so pin the workspace root
  // to this project to keep Turbopack from inferring the wrong directory.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
