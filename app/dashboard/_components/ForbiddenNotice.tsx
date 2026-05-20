"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

// RBAC 차단 안내 배너 — middleware 가 권한 미달 시 /dashboard?reason=forbidden 로
// redirect 한다. 운영자에게 "왜 다른 페이지가 아닌 여기로 왔는지" 를 명시.
function ForbiddenNoticeInner() {
  const params = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || params.get("reason") !== "forbidden") return null;
  return (
    <div className="rounded-2xl bg-amber-50/85 border border-amber-200 px-4 py-3 flex items-start gap-3">
      <span className="text-amber-600 text-lg leading-none">⚠</span>
      <div className="flex-1 text-sm text-amber-800">
        <p className="font-semibold">접근 권한이 없는 페이지입니다.</p>
        <p className="text-xs mt-0.5 text-amber-700">
          요청한 화면은 현재 운영자 역할로 접근할 수 없어 대시보드로 이동했습니다. 권한이
          필요하면 최고관리자에게 문의하세요.
        </p>
      </div>
      <button
        className="text-xs text-amber-700 underline shrink-0"
        type="button"
        onClick={() => setDismissed(true)}
      >
        닫기
      </button>
    </div>
  );
}

export function ForbiddenNotice() {
  // useSearchParams 는 Suspense 경계가 필요 — Next 14 빌드 요구사항.
  return (
    <Suspense fallback={null}>
      <ForbiddenNoticeInner />
    </Suspense>
  );
}
