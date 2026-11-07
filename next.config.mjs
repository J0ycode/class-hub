/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // data/catalogue.json is read with fs at runtime; make sure Vercel bundles it.
  outputFileTracingIncludes: {
    "/**/*": ["./data/catalogue.json"],
  },
};

export default nextConfig;
