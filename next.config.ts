import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF statements go through a Server Action; default cap is 1MB. Vercel's own cap is 4.5MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
