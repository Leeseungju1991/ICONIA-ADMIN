"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/lib/actions/login";
import type { FormState } from "@/lib/types";
import { messageForCode } from "@/lib/errorMessages";

// P0 보안 정상화 (2026-05-19): localStorage / 하드코딩 자격증명 우회 제거.
// Server action loginAction 만 호출. 결과는 form state 로 받는다.
export default function LoginForm() {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [state, setState] = useState<FormState | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDev = process.env.NODE_ENV !== "production";

  function submit() {
    setState(null);
    const fd = new FormData();
    fd.append("username", id.trim());
    fd.append("password", pw);
    startTransition(async () => {
      const next = await loginAction(undefined, fd);
      // server action 이 redirect 하면 여기까지 도달하지 않는다.
      setState(next);
    });
  }

  const errMessage = state?.status === "error"
    ? messageForCode(state.code, state.message)
    : null;

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl border border-white/60 flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center">
          <UserIcon className="w-5 h-5 text-slate-500" />
        </div>
        <input
          className="flex-1 bg-transparent outline-none placeholder:text-slate-400 text-slate-700"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="ID"
          autoComplete="username"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </div>

      <div className="glass rounded-xl border border-white/60 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3">
        <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center">
          <LockIcon className="w-5 h-5 text-slate-500" />
        </div>
        <div className="relative flex-1 min-w-0">
          <input
            className="w-full bg-transparent outline-none placeholder:text-slate-400 text-slate-700 pr-10"
            type={showPw ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <button
            type="button"
            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/60 text-slate-500"
            onClick={() => setShowPw((p) => !p)}
            aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 표시"}
          >
            {showPw ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {errMessage ? <div className="text-sm text-rose-600">{errMessage}</div> : null}

      <button
        className="w-full btn-primary py-3 text-base disabled:opacity-60"
        onClick={submit}
        disabled={isPending}
        type="button"
      >
        {isPending ? "로그인 중..." : "Sign in"}
      </button>

      {isDev ? (
        <div className="text-xs text-slate-400 text-center">
          dev 환경 — 서버에 등록된 운영자 계정으로 로그인하세요.
        </div>
      ) : null}
    </div>
  );
}

function UserIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 20.5c1.8-4 6-6 8-6s6.2 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 11h11A1.5 1.5 0 0 1 19 12.5v7A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-7A1.5 1.5 0 0 1 6.5 11Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function EyeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 15a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function EyeOffIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.5 10.7A2.6 2.6 0 0 0 12 15a3 3 0 0 0 1.3-.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.3 7.2C3.6 9 2.5 12 2.5 12s3.5 7 9.5 7c1.7 0 3.2-.3 4.5-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.7 5.4A10.4 10.4 0 0 1 12 5c6 0 9.5 7 9.5 7s-1.2 2.4-3.6 4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
