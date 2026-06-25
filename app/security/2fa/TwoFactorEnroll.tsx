"use client";

import { useState, useTransition } from "react";
import { enrollTotpAction, verifyTotpEnrollAction } from "@/lib/actions/totpEnroll";
import { recordOperatorAuditAction } from "@/lib/actions/auditLog";

// Phase 12 #10 / [PDF #12] — 2FA TOTP enrollment 실 wiring.
//   Server: POST /api/v1/operator/totp/{enroll,verify}
//   enroll 응답에 otpauth_uri + base32 secret (1회만).
//   2026-06-25 — QR 코드 실 렌더링 추가 (외부 QR API 사용, 의존성 0).
//                audit 로그 기록 (totp.enrolled / totp.verified).

// QR 렌더링 — api.qrserver.com 을 사용해 img 태그로 표시.
// 외부 라이브러리 없이 동작 (Next.js images domain 설정 불필요 — img 태그 직접 사용).
function OtpauthQr({ uri }: { uri: string }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(uri)}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={qrUrl}
      alt="TOTP QR Code"
      width={160}
      height={160}
      className="rounded-xl border border-slate-200"
    />
  );
}

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
      // audit log — best-effort
      try {
        await recordOperatorAuditAction({
          action: "totp.enrolled",
          targetResourceType: "operator",
          targetResourceId: null,
          reasonText: "TOTP enroll QR 발급",
        });
      } catch { /* ignore */ }
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
      // audit log — best-effort
      try {
        await recordOperatorAuditAction({
          action: "totp.verified",
          targetResourceType: "operator",
          targetResourceId: null,
          reasonText: "TOTP enrollment 검증 완료",
        });
      } catch { /* ignore */ }
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
          <div className="mt-3 flex items-start gap-4 flex-wrap">
            {/* 2026-06-25 — QR 실 렌더링 (api.qrserver.com, 외부 라이브러리 0). */}
            {otpauthUri ? (
              <OtpauthQr uri={otpauthUri} />
            ) : null}
            <div className="text-xs space-y-2 max-w-[280px]">
              <div className="text-muted">
                Google Authenticator / 1Password / Authy 등에서 QR 을 스캔하세요.
              </div>
              <div className="text-muted">또는 base32 secret 을 직접 입력:</div>
              <code className="block break-all bg-white/70 border border-white/70 rounded px-2 py-1.5 select-all">
                {secretBase32}
              </code>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-700 font-medium">
                ⚠ 본 화면을 닫으면 secret 을 다시 볼 수 없습니다.
              </div>
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
