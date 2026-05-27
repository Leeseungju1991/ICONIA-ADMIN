"use client";

// Next.js 14 App Router global error boundary — root layout 자체가 실패할 때만
// 실행. 본 파일은 자체 <html> / <body> 를 렌더해야 한다 (root layout 가 죽었으므로).
// 일반 페이지 에러는 app/error.tsx 가 처리한다.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[admin] global-error boundary", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#f8fafc",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif",
        }}
      >
        <div style={{ maxWidth: 560, margin: "10vh auto", padding: 24 }}>
          <div
            style={{
              borderRadius: 24,
              background: "#fff",
              border: "1px solid #fecaca",
              padding: 24,
              boxShadow: "0 8px 32px rgba(15,23,42,0.08)",
            }}
          >
            <h1 style={{ margin: 0, fontSize: 20, color: "#991b1b" }}>
              관리자 콘솔에 문제가 발생했습니다
            </h1>
            <p style={{ marginTop: 8, fontSize: 13, color: "#7f1d1d" }}>
              잠시 후 다시 시도하거나 새로고침 해주세요.
            </p>
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: "#fef2f2",
                borderRadius: 12,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 12,
                color: "#7f1d1d",
                wordBreak: "break-all",
              }}
            >
              {error.message || "Unknown error"}
              {error.digest ? (
                <div style={{ marginTop: 6, opacity: 0.8 }}>
                  digest: {error.digest}
                </div>
              ) : null}
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  borderRadius: 12,
                  background: "#0f172a",
                  color: "#fff",
                  padding: "8px 16px",
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                다시 시도
              </button>
              <a
                href="/dashboard"
                style={{
                  borderRadius: 12,
                  background: "#fff",
                  color: "#334155",
                  padding: "8px 16px",
                  fontSize: 13,
                  border: "1px solid #cbd5e1",
                  textDecoration: "none",
                }}
              >
                대시보드로
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
