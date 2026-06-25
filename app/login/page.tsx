import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { readSession } from "@/lib/authCookie";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }> | { reason?: string };
}) {
  if (await readSession()) {
    redirect("/dashboard");
  }

  // Next.js 15: searchParams 가 Promise 로 래핑되는 경우 await.
  const resolvedParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const reason = resolvedParams?.reason;
  const banner = reasonToBanner(reason);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-[32px] glass-panel px-10 py-12">
        <div className="text-center">
          <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-700">
            <span className="block">ICONIA</span>
            <span className="block">관리자 페이지</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            본 시스템은 만 14세 이상 운영자에게만 제공됩니다.
          </p>
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
