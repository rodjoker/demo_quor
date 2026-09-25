import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Las fotos del catálogo se sirven desde la tienda de Quor (demo)
    remotePatterns: [
      { protocol: "https", hostname: "quorproducts.co", pathname: "/wp-content/uploads/**" },
    ],
  },
};

export default nextConfig;
