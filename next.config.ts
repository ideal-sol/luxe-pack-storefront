import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 未設定も空文字として埋め込み、起動時 ENV では GTM を有効化しない。
  env: { NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "" },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
