import type { Metadata, Viewport } from "next";
import { roboto, notoSansKr } from "./(theme)/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "ICONIA Admin",
  description: "ICONIA 운영 콘솔",
  robots: { index: false, follow: false },
};

// 모바일 렌더링 정합 — device-width 기준 스케일 + notch safe-area 활성(viewport-fit=cover).
// Sidebar 가 env(safe-area-inset-*) 패딩을 참조하므로 cover 가 있어야 노치 단말에서 올바른 여백.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${roboto.variable} ${notoSansKr.variable}`}>
      <body>{children}</body>
    </html>
  );
}
