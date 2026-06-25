import { redirect } from "next/navigation";
import { readSession } from "@/lib/authCookie";
import { loadIconiaEnv } from "@/lib/env";
import TwoFactorEnroll from "./TwoFactorEnroll";
import BackupCodePanel from "./BackupCodePanel";

// P1 §6 (2026-05-19) — 2FA TOTP 도입 scaffold.
//
// 목적: Owner 강제 enrollment 화면. 로그인 직후 2FA 미설정이면 본 페이지로 강제 진입.
// 본 라운드에서는 UI 스캐폴드 + server action stub. 실제 secret 발급/검증은
// Server `/api/v1/operator/2fa/*` 엔드포인트가 도입되면 wire.
//
// 사용자 결정 필요사항 (B): 라이브러리 후보 — otplib (메인테너 활발) 추천. speakeasy 는
// 2019 이후 dormant. 본 라운드에서는 server-side enroll, admin 은 client display 만.

export const dynamic = "force-dynamic";

export default async function TwoFactorPage() {
  const jwt = await readSession();
  if (!jwt) {
    redirect("/login?reason=missing");
  }

  const env = loadIconiaEnv();
  const isProd = env === "production";

  return (
    <div className="min-h-screen p-6 flex items-start justify-center">
      <div className="w-full max-w-2xl rounded-[32px] glass-panel px-8 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">2단계 인증 설정</h1>
        <p className="text-sm text-muted mt-1">
          ICONIA 운영 콘솔은 운영 환경에서 2FA TOTP 가 필수입니다.
        </p>

        {!isProd ? (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-800">
            현재 환경: <b>{env}</b> — dev/staging 에서는 2FA enrollment 가 선택적입니다.
            본 화면은 동작을 미리 확인하기 위한 미리보기입니다.
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
            운영 환경 — 2FA 등록 전에는 대시보드 접근이 제한됩니다.
          </div>
        )}

        <TwoFactorEnroll />

        <div className="mt-8">
          <BackupCodePanel />
        </div>

        <p className="mt-6 text-[11px] text-muted">
          ※ TOTP enrollment UI 는 scaffold 단계 (Server `/api/v1/operator/2fa/*` 대기).
          백업 코드는 Phase 9 #5 — Server endpoint 실 연동.
        </p>
      </div>
    </div>
  );
}
