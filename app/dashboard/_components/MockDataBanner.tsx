// MockDataBanner — Server endpoint 미구현 또는 wiring 보류 화면의 데모 데이터 명시.
//
// 진단표 Phase 10 가짜 구현 카탈로그 정정 (#5/#7/#9). 운영자가 mock 과 실 데이터를
// 시각적으로 구분하도록 강제. 라벨이 표시되는 동안에는 본 페이지의 데이터는
// 운영 의사결정 근거로 사용 금지.

export function MockDataBanner({
  reason,
  endpoint,
}: {
  /** "Server endpoint 미구현" / "wiring 보류" 등. */
  reason: string;
  /** 향후 wiring 시 사용할 endpoint (있다면 표시). */
  endpoint?: string;
}) {
  return (
    <div
      className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/70 px-4 py-3 text-sm"
      role="status"
      aria-label="데모 데이터 안내"
    >
      <div className="flex items-center gap-2">
        <span className="chip chip-warn">DEMO</span>
        <span className="font-semibold text-amber-800">데모 데이터 — 운영 의사결정 금지</span>
      </div>
      <div className="mt-1 text-xs text-amber-700">
        {reason}
        {endpoint ? (
          <>
            {" · 예정 endpoint: "}
            <code className="font-mono">{endpoint}</code>
          </>
        ) : null}
      </div>
    </div>
  );
}
