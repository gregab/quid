import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  basePath: "/quid",
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
