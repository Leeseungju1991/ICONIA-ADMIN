import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { readSession } from "@/lib/authCookie";

// P0 보안 정상화 (2026-05-19):
//   - 이전 클라이언트 `soomAuth.ts` + localStorage 우회 완전 제거.
//   - Server Component 로 cookie 를 직접 확인 → 인증된 운영자는 즉시 /dashboard.
//   - LoginForm (client) 은 server action `loginAction` 만 호출 — Server boundary 가 권위.

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { reason?: string };
}) {
  if (readSession()) {
    redirect("/dashboard");
  }

  const reason = searchParams?.reason;
  const banner = reasonToBanner(reason);

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

        {banner ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
            {banner}
          </div>
        ) : null}

        <div className="mt-10">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

function reasonToBanner(reason: string | undefined): string | null {
  switch (reason) {
    case "expired":
      return "세션이 만료되어 로그아웃되었습니다. 다시 로그인해 주세요.";
    case "invalid":
      return "세션이 유효하지 않아 로그아웃되었습니다. 다시 로그인해 주세요.";
    case "missing":
      return "로그인이 필요합니다.";
    case "idle":
      return "장시간 활동이 없어 자동 로그아웃되었습니다.";
    default:
      return null;
  }
}
