"use client";

import { useState } from "react";

// P1 §6 — 2FA TOTP enrollment UI (client). 본 라운드는 stub:
//   - "QR 발급" 버튼 클릭 시 서버 호출 (현재 미구현 → 안내).
//   - 6자리 TOTP 입력 검증 UI 만 제공.
// 실제 secret/QR 발급 + 검증은 Server 엔드포인트 도입 후 연결.
export default function TwoFactorEnroll() {
  const [step, setStep] = useState<"idle" | "issued" | "verified">("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function issue() {
    setError(null);
    // TODO(P1 §6): Server `/api/v1/operator/2fa/enroll` 호출 → otpauth_url + base32 secret.
    setStep("issued");
  }

  function verify() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("6자리 숫자 코드를 입력하세요.");
      return;
    }
    // TODO(P1 §6): Server `/api/v1/operator/2fa/verify` 호출.
    setStep("verified");
  }

  if (step === "verified") {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm text-emerald-800">
        2FA 등록이 완료되었습니다. 다음 로그인부터 인증 코드가 필요합니다. (stub)
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-white/60 bg-white/55 p-4">
        <div className="text-sm font-medium text-slate-800">1단계 — Authenticator 등록</div>
        <p className="text-xs text-muted mt-1">
          Google Authenticator / 1Password / Authy 중 하나로 QR 코드를 스캔합니다.
        </p>
        {step === "idle" ? (
          <button className="mt-3 btn-primary text-sm" type="button" onClick={issue}>
            QR 발급 (서버 stub)
          </button>
        ) : (
          <div className="mt-3 flex items-center gap-4">
            <div className="h-32 w-32 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-[10px] text-slate-400">
              QR placeholder
            </div>
            <code className="text-xs text-muted break-all max-w-[200px]">
              otpauth://totp/ICONIA-Admin?secret=PLACEHOLDER&issuer=ICONIA
            </code>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/60 bg-white/55 p-4">
        <div className="text-sm font-medium text-slate-800">2단계 — 6자리 코드 입력</div>
        <div className="mt-3 flex gap-2">
          <input
            className="input max-w-[160px] tracking-widest text-center font-mono"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button
            className="btn-primary text-sm disabled:opacity-60"
            type="button"
            disabled={step !== "issued"}
            onClick={verify}
          >
            검증
          </button>
        </div>
        {error ? <div className="mt-2 text-xs text-rose-600">{error}</div> : null}
      </div>
    </div>
  );
}
