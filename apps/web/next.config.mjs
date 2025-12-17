/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins: ["http://localhost:3000", "http://172.20.10.3:3000"]
};

export default nextConfig;


