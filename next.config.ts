import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // 親ディレクトリ (C:\Users\hoshi) の lockfile 誤検出で全ページ 404 になるのを防ぐ
  turbopack: {
    root: projectRoot,
  },
  // ローカル開発時、同一LAN内のデバイス（タブレット・スマホ）からのHMR接続を許可
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: ["192.168.0.212"],
  }),
};

export default nextConfig;
