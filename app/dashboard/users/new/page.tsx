"use client";

// (주)숨코리아 출시 정비 — 운영팀 수동 사용자 추가 페이지.
//
// 2026-06-01 — 사용자 요청 단순화: 이메일/비밀번호/UUID 3개 필드.
//   - 이메일, 비밀번호: 필수
//   - UUID: 선택 (비우면 server 가 자동 생성)
//   - 약관/19+/사유/이메일자동검증/표시이름 등 부가 메타는 ADMIN UI 에서 자동 채움
//     (운영자가 ADMIN 으로 직접 추가하는 시점에 19+ 책임은 운영자에게 귀속,
//      약관 v1.0 자동 동의, reason="admin_manual_create", autoVerified=true).
//   - 감사 로그에는 그대로 기록됨.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PanelCard } from "../../_components/PanelCard";
import { createAdminUserAction } from "@/lib/actions/adminUserCreate";
import { adminErrorMessageKo } from "@/lib/adminApi";

const AUTO_TERMS_VERSION = "1.0";
const AUTO_REASON = "admin_manual_create";

export default function NewUserPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [uuid, setUuid] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function clientValidate(): string | null {
    const fe: Record<string, string> = {};
    if (!email) fe.email = "이메일을 입력하세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fe.email = "이메일 형식이 올바르지 않습니다.";
    if (!password) fe.password = "비밀번호를 입력하세요.";
    else if (password.length < 8) fe.password = "비밀번호는 8자 이상이어야 합니다.";
    if (uuid.trim() !== "" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid.trim()))
      fe.uuid = "UUID 형식이 올바르지 않습니다 (예: 8-4-4-4-12 hex). 비우면 자동 생성.";
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return "입력값을 확인하세요.";
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ve = clientValidate();
    if (ve) {
      setError(ve);
      return;
    }
    submit();
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createAdminUserAction({
        email: email.trim(),
        password,
        agreedTermsVersion: AUTO_TERMS_VERSION,
        ageVerified: true,
        autoVerified: true,
        reason: AUTO_REASON,
        ...(uuid.trim() ? { id: uuid.trim() } : {}),
      });
      if (!res.ok) {
        if (
          res.code === "ERR_SERVER_UNAVAILABLE" ||
          res.code === "ERR_NETWORK" ||
          res.code === "ERR_INVALID_RESPONSE"
        ) {
          setError("Server 준비 중입니다. 잠시 후 다시 시도하세요.");
          return;
        }
        if (res.code === "ERR_USER_EMAIL_EXISTS") {
          setFieldErrors((p) => ({ ...p, email: "이미 사용 중인 이메일입니다." }));
          setError("이미 사용 중인 이메일입니다.");
          return;
        }
        if (res.code === "ERR_USER_ID_EXISTS") {
          setFieldErrors((p) => ({ ...p, uuid: "이미 사용 중인 UUID 입니다." }));
          setError("이미 사용 중인 UUID 입니다.");
          return;
        }
        setError(adminErrorMessageKo(res.code) || res.message);
        return;
      }
      const id = res.data.user.id;
      router.push(`/dashboard/users?created=${encodeURIComponent(id)}`);
    });
  }

  return (
    <div className="space-y-6">
      <PanelCard
        title="사용자 추가"
        description="이메일·비밀번호로 신규 사용자를 생성합니다. ID 를 비워두면 자동 생성되며 감사 로그에 기록됩니다."
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

        <form className="grid grid-cols-1 gap-4" onSubmit={handleSubmit}>
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

          <Field label="비밀번호 (8자 이상)" error={fieldErrors.password} required>
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
          </Field>

          <Field
            label="UUID (선택 — 비우면 자동 생성)"
            error={fieldErrors.uuid}
          >
            <input
              type="text"
              className="input w-full font-mono text-sm"
              value={uuid}
              onChange={(e) => setUuid(e.target.value)}
              autoComplete="off"
              placeholder="자동 생성 (또는 8-4-4-4-12 hex 직접 입력)"
              maxLength={36}
            />
            <p className="text-[11px] text-muted mt-1">
              마이그레이션·복구 등 특수 케이스에서 기존 ID를 보존할 때만 직접 입력. 일반적으로 비우세요.
            </p>
          </Field>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 space-y-1">
            <p>
              <strong className="text-slate-800">자동 적용 사항:</strong>
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>약관 v{AUTO_TERMS_VERSION} (서비스/개인정보/제3자 제공) 운영자 대리 동의</li>
              <li>19세 이상 본인 확인 — 운영자 책임</li>
              <li>이메일 자동 검증 처리 (별도 인증 메일 없음)</li>
              <li>운영자 사유: <code className="text-slate-700">{AUTO_REASON}</code> (감사 로그 기록)</li>
            </ul>
          </div>

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
              {pending ? "추가 중..." : "사용자 추가"}
            </button>
          </div>
        </form>
      </PanelCard>
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
