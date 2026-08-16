import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: ["192.168.56.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fxckgpbsnsobrtebmstp.supabase.co",
        pathname: "/storage/v1/object/public/CodartlbShop/**",
      },
    ],
  },
};

export default nextConfig;
