"use client";

import { useState, useTransition } from "react";
import { enrollTotpAction, verifyTotpEnrollAction } from "@/lib/actions/totpEnroll";

// Phase 12 #10 — 2FA TOTP enrollment 실 wiring.
//   Server: POST /api/v1/operator/totp/{enroll,verify}
//   enroll 응답에 otpauth_uri + base32 secret (1회만), QR 은 클라이언트에서 렌더.
export default function TwoFactorEnroll() {
  const [step, setStep] = useState<"idle" | "issued" | "verified">("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issuePending, startIssue] = useTransition();
  const [verifyPending, startVerify] = useTransition();
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [secretBase32, setSecretBase32] = useState<string | null>(null);

  function issue() {
    setError(null);
    startIssue(async () => {
      const r = await enrollTotpAction();
      if (!r.ok) {
        setError(`enroll 실패 (${r.code ?? "ERR"}): ${r.message}`);
        return;
      }
      setOtpauthUri(r.otpauth_uri);
      setSecretBase32(r.totp_secret_base32);
      setStep("issued");
    });
  }

  function verify() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("6자리 숫자 코드를 입력하세요.");
      return;
    }
    startVerify(async () => {
      const r = await verifyTotpEnrollAction({ code });
      if (!r.ok) {
        setError(`verify 실패 (${r.code ?? "ERR"}): ${r.message}`);
        return;
      }
      setStep("verified");
    });
  }

  if (step === "verified") {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm text-emerald-800">
        ✓ 2FA 등록 완료. 다음 로그인부터 Authenticator 코드가 필요합니다. 백업 코드는 아래 패널에서 발급하세요.
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
          <button
            className="mt-3 btn-primary text-sm disabled:opacity-60"
            type="button"
            onClick={issue}
            disabled={issuePending}
          >
            {issuePending ? "발급 중..." : "QR 발급 (Server enroll)"}
          </button>
        ) : (
          <div className="mt-3 flex items-start gap-4">
            <div className="h-32 w-32 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-[10px] text-slate-400">
              {/* QR 렌더링은 클라이언트 라이브러리 (qrcode 등) 도입 시. 현재는 otpauth URI 텍스트 표시. */}
              QR (URI 복사)
            </div>
            <div className="text-xs space-y-1 max-w-[260px]">
              <div className="text-muted">Authenticator 앱에서 다음 URI 또는 secret 으로 등록:</div>
              <code className="block break-all bg-white/70 border border-white/70 rounded px-2 py-1">
                {otpauthUri}
              </code>
              <div className="text-muted">또는 base32 secret:</div>
              <code className="block break-all bg-white/70 border border-white/70 rounded px-2 py-1">
                {secretBase32}
              </code>
              <div className="text-amber-700">⚠ 본 화면을 닫으면 secret 을 다시 볼 수 없습니다.</div>
            </div>
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
            disabled={step !== "issued" || verifyPending}
            onClick={verify}
          >
            {verifyPending ? "검증 중..." : "검증"}
          </button>
        </div>
        {error ? <div className="mt-2 text-xs text-rose-600">{error}</div> : null}
      </div>
    </div>
  );
}
