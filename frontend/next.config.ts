import type { NextConfig } from "next";
import path from "node:path";

const backendURL = process.env.BACKEND_URL ?? "http://127.0.0.1:8080";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.resolve("."),
  },
  images: {
    // Local public images are unoptimized by default in standalone output;
    // add remotePatterns here when serving images from external hosts.
    unoptimized: true,
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendURL}/api/v1/:path*` }];
  },
};

export default nextConfig;
