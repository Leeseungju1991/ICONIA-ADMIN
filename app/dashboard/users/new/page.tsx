"use client";

// (주)숨코리아 출시 정비 — 운영팀 수동 사용자 추가 페이지.
//
// 사용자가 직접 가입하지 못하는 상황(영업·마케팅·B2B 시연 등) 에서 운영자가
// 대리로 가입 절차를 진행하기 위한 폼. 모든 작업은 Server audit_log 에
// 영구 기록되며, 약관 4종 대리 동의 + 19세 이상 본인 확인 체크가 강제된다.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PanelCard } from "../../_components/PanelCard";
import { createAdminUserAction } from "@/lib/actions/adminUserCreate";
import { adminErrorMessageKo } from "@/lib/adminApi";

const TERMS_VERSION_OPTIONS = ["1.0", "1.1", "2.0"];

type PasswordStrength = "weak" | "medium" | "strong";

/**
 * 비밀번호 강도 산정 — zxcvbn 없이 단순 규칙. 길이 + 대/소/숫자/특수문자 변별.
 * 운영자 1차 가이드 — Server 가 별도 검증 정책(8자 이상) 을 다시 수행한다.
 */
function passwordStrength(pw: string): PasswordStrength {
  if (pw.length < 8) return "weak";
  let variety = 0;
  if (/[a-z]/.test(pw)) variety++;
  if (/[A-Z]/.test(pw)) variety++;
  if (/[0-9]/.test(pw)) variety++;
  if (/[^a-zA-Z0-9]/.test(pw)) variety++;
  if (pw.length >= 12 && variety >= 3) return "strong";
  if (pw.length >= 10 && variety >= 2) return "medium";
  return variety >= 3 ? "medium" : "weak";
}

export default function NewUserPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [termsVersion, setTermsVersion] = useState(TERMS_VERSION_OPTIONS[0]);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [autoVerify, setAutoVerify] = useState(true);
  const [reason, setReason] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const strength = passwordStrength(password);
  const strengthLabel: Record<PasswordStrength, string> = {
    weak: "약함",
    medium: "보통",
    strong: "강함",
  };
  const strengthColor: Record<PasswordStrength, string> = {
    weak: "bg-red-500",
    medium: "bg-amber-500",
    strong: "bg-emerald-500",
  };
  const strengthWidth: Record<PasswordStrength, string> = {
    weak: "w-1/3",
    medium: "w-2/3",
    strong: "w-full",
  };

  function clientValidate(): string | null {
    const fe: Record<string, string> = {};
    if (!email) fe.email = "이메일을 입력하세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fe.email = "이메일 형식이 올바르지 않습니다.";
    if (!password) fe.password = "비밀번호를 입력하세요.";
    else if (password.length < 8) fe.password = "비밀번호는 8자 이상이어야 합니다.";
    if (password !== passwordConfirm) fe.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (!termsAgreed) fe.termsAgreed = "약관 4종 대리 동의가 필요합니다.";
    if (!ageVerified) fe.ageVerified = "19세 이상 본인 확인이 필요합니다.";
    if (!termsVersion) fe.termsVersion = "약관 버전을 선택하세요.";
    if (!reason || reason.trim().length < 5)
      fe.reason = "운영자 사유는 5자 이상 입력하세요.";
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return "입력값을 확인하세요.";
    return null;
  }

  function openConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ve = clientValidate();
    if (ve) {
      setError(ve);
      return;
    }
    setConfirmOpen(true);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createAdminUserAction({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        agreedTermsVersion: termsVersion,
        ageVerified,
        autoVerified: autoVerify,
        reason: reason.trim(),
      });
      if (!res.ok) {
        setConfirmOpen(false);
        // 에러 코드별 한글 매핑 + 5xx 시 graceful "준비 중".
        if (
          res.code === "ERR_SERVER_UNAVAILABLE" ||
          res.code === "ERR_NETWORK" ||
          res.code === "ERR_INVALID_RESPONSE"
        ) {
          setError("Server 준비 중입니다. 입력값을 보존했으니 잠시 후 다시 시도하세요.");
          return;
        }
        if (res.code === "ERR_USER_EMAIL_EXISTS") {
          setFieldErrors((p) => ({ ...p, email: "이미 사용 중인 이메일입니다." }));
          setError("이미 사용 중인 이메일입니다.");
          return;
        }
        if (res.code === "ERR_TERMS_REQUIRED") {
          setError("약관 동의·19세 이상 확인이 필요합니다.");
          return;
        }
        setError(adminErrorMessageKo(res.code) || res.message);
        return;
      }
      // 성공 → 사용자 목록 페이지로 redirect (사용자 상세 페이지는 list 페이지 drawer 가 담당).
      // query 로 신규 생성 ID 와 created=1 플래그를 전달 — 목록 페이지가 토스트 표시 + drawer 자동 오픈.
      const id = res.data.user.id;
      router.push(`/dashboard/users?created=${encodeURIComponent(id)}`);
    });
  }

  return (
    <div className="space-y-6">
      <PanelCard
        title="사용자 추가"
        description="운영팀이 사용자를 대신해 가입을 진행합니다. 모든 작업은 감사 로그에 기록됩니다."
        actions={
          <button
            type="button"
            className="btn-outline text-xs"
            onClick={() => router.push("/dashboard/users")}
          >
            ← 사용자 목록
          </button>
        }
      >
        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <form className="grid grid-cols-1 gap-4" onSubmit={openConfirm}>
          <Field label="이메일" error={fieldErrors.email} required>
            <input
              type="email"
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              placeholder="user@example.com"
              required
            />
          </Field>

          <Field label="비밀번호" error={fieldErrors.password} required>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="input w-full pr-16"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-white/70 border border-white/70 px-2 py-0.5 text-[11px] text-slate-600"
              >
                {showPassword ? "숨기기" : "보기"}
              </button>
            </div>
            {password ? (
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full ${strengthColor[strength]} ${strengthWidth[strength]} transition-all`}
                    data-testid="pw-strength-bar"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  비밀번호 강도: <span data-testid="pw-strength-label">{strengthLabel[strength]}</span>
                </p>
              </div>
            ) : null}
          </Field>

          <Field label="비밀번호 확인" error={fieldErrors.passwordConfirm} required>
            <input
              type={showPassword ? "text" : "password"}
              className="input w-full"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>

          <Field label="표시 이름 (선택)" error={fieldErrors.displayName}>
            <input
              type="text"
              className="input w-full"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="비워두면 이메일 prefix 사용"
            />
          </Field>

          <Field label="약관 버전" error={fieldErrors.termsVersion} required>
            <select
              className="select w-full"
              value={termsVersion}
              onChange={(e) => setTermsVersion(e.target.value)}
            >
              {TERMS_VERSION_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  v{v}
                </option>
              ))}
            </select>
          </Field>

          <div className="rounded-xl bg-amber-50/60 border border-amber-200 p-3 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-slate-800">
                사용자 대신 4종 약관(서비스/개인정보/마케팅/제3자 제공) 에 동의했음을 확인합니다.
                {fieldErrors.termsAgreed ? (
                  <span className="block text-xs text-red-700 mt-0.5">{fieldErrors.termsAgreed}</span>
                ) : null}
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ageVerified}
                onChange={(e) => setAgeVerified(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-slate-800">
                19세 이상 본인 확인을 완료했습니다.
                {fieldErrors.ageVerified ? (
                  <span className="block text-xs text-red-700 mt-0.5">{fieldErrors.ageVerified}</span>
                ) : null}
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoVerify}
                onChange={(e) => setAutoVerify(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-slate-800">
                이메일 자동 검증 처리 (체크 시 별도 인증 메일 없이 활성 상태)
              </span>
            </label>
          </div>

          <Field label="운영자 사유 (5~256자)" error={fieldErrors.reason} required>
            <textarea
              className="input w-full min-h-[80px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={256}
              placeholder="예: 영업 미팅 시연용 / 사용자 직접 가입 불가 (해외)"
              required
            />
            <p className="text-[11px] text-muted mt-1">
              {reason.length} / 256 — 감사 로그에 기록됩니다.
            </p>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-outline text-sm"
              onClick={() => router.push("/dashboard/users")}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-primary text-sm disabled:opacity-60"
              disabled={pending}
            >
              사용자 생성
            </button>
          </div>
        </form>
      </PanelCard>

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md glass-panel rounded-3xl p-6">
            <h3 className="text-lg font-bold text-slate-900">사용자 추가 확정</h3>
            <p className="text-xs text-muted mt-1">
              아래 정보로 사용자를 추가합니다. 작업 후 취소할 수 없습니다.
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <ConfirmRow k="이메일" v={email} />
              <ConfirmRow k="표시 이름" v={displayName || `(자동: ${email.split("@")[0]})`} />
              <ConfirmRow k="약관 버전" v={`v${termsVersion}`} />
              <ConfirmRow k="자동 이메일 검증" v={autoVerify ? "예" : "아니오"} />
              <ConfirmRow k="사유" v={reason} />
            </dl>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-outline text-sm"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
              >
                돌아가기
              </button>
              <button
                type="button"
                className="btn-primary text-sm disabled:opacity-60"
                disabled={pending}
                onClick={submit}
              >
                {pending ? "생성 중..." : "확정 — 사용자 추가"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  error,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">
        {label}
        {required ? <span className="text-red-600 ml-0.5">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-red-700 mt-1">{error}</p> : null}
    </div>
  );
}

function ConfirmRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <dt className="text-xs text-muted shrink-0 w-24">{k}</dt>
      <dd className="text-sm text-slate-800 font-medium break-all">{v}</dd>
    </div>
  );
}
