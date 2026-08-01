/* eslint-disable @next/next/no-page-custom-font -- 该规则仅针对 Pages Router 的 pages/_document.js；App Router 根布局手写 <link> 是有效且全站生效的做法，故 disable */
import type { Metadata, Viewport } from "next";
import StateSync from "@/components/shared/StateSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "快乐识字",
  description: "小朋友学汉字的趣味工具",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "识字",
  },
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 3,
  themeColor: "#FF6B9D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        {/* Google Fonts: ZCOOL KuaiLe 卡通圆体 */}
        <link
          href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        <StateSync />
        {children}
      </body>
    </html>
  );
}
