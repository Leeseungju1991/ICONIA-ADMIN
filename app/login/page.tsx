"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthed, login as doLogin } from "@/lib/soomAuth";

export default function LoginPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isAuthed()) router.replace("/dashboard");
  }, [router]);

  function submit() {
    setErr("");
    const ok = doLogin(id.trim(), pw);
    if (!ok) {
      setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-[32px] glass-panel px-10 py-12">
        <div className="text-center">
          <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-700">
            <span className="block">ICONIA</span>
            <span className="block">Admin Console</span>
          </div>
          <div className="text-sm text-slate-400 mt-2">관리자 로그인 페이지</div>
        </div>

        <div className="mt-10 space-y-4">
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

          {err && <div className="text-sm text-rose-600">{err}</div>}

          <button className="w-full btn-primary py-3 text-base" onClick={submit}>
            Sign in
          </button>

          <div className="text-xs text-slate-400 text-center">로그인: soom / soom</div>
        </div>
      </div>
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
