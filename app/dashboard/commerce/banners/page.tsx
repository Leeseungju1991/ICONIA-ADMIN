// 2026-06-04 — 사용자 요청: "배너목록은 일단 모두 제거".
// 라우트는 보존하되 일시적으로 비공개 안내 페이지로 단락 처리.
// 향후 운영 재개 시 BannersClient 복원.
export const dynamic = "force-dynamic";

export default function BannersPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 9h18" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-slate-800">배너 운영 일시 중단</h2>
        <p className="mt-1 text-sm text-slate-500">
          배너 목록과 작성 기능은 일시적으로 비공개되어 있습니다. 재개 시 별도 공지됩니다.
        </p>
      </div>
    </div>
  );
}
