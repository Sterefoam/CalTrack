import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"]
};

export default nextConfig;
