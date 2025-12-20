// apps/web/next.config.mjs
var DEFAULT_API_BASE_URL = process.env.NODE_ENV === "production" ? "https://taskora-api-fq54fov6wq-rj.a.run.app" : "http://localhost:8080";
var nextConfig = {
  eslint: {
    ignoreDuringBuilds: false
  },
  typescript: {
    ignoreBuildErrors: false
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups"
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "unsafe-none"
          }
        ]
      }
    ];
  }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
