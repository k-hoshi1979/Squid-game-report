import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ローカル開発時、同一LAN内のデバイス（タブレット・スマホ）からのHMR接続を許可
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: ["192.168.0.212"],
  }),
};

export default nextConfig;
