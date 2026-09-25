import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Solo desarrollo: Next 16 bloquea los recursos de `next dev` pedidos desde otro origen que
  // `localhost`. Se permite 127.0.0.1 para poder usar una bolsa de cookies distinta a la de localhost.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Las fotos del catálogo se sirven desde la tienda de Quor (demo)
    remotePatterns: [
      { protocol: "https", hostname: "quorproducts.co", pathname: "/wp-content/uploads/**" },
    ],
  },
};

export default nextConfig;
