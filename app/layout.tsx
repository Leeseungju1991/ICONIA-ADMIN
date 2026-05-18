import type { Metadata } from "next";
import { roboto, notoSansKr } from "./(theme)/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "ICONIA Admin",
  description: "ICONIA 운영 콘솔",
  robots: { index: false, follow: false },
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
