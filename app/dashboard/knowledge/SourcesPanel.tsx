"use client";

// 소스 목록 패널 — 서버측 listRagSources 결과(ServerResult)를 props 로 받아 렌더.
// 선택 시 onSelect 콜백으로 상위(KnowledgeConsole)에 알림. 선택된 소스 하이라이트.
// snake_case 필드(updated_at) 그대로 표시.

import type { RagSource } from "@/lib/api/rag";
import type { ServerResult } from "@/lib/types";

export function SourcesPanel({
  result,
  selectedId,
  onSelect,
}: {
  result: ServerResult<RagSource[]>;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (!result.ok) {
    return <div className="error">{result.code}: {result.message}</div>;
  }
  if (result.data.length === 0) {
    return <div className="empty">등록된 소스 없음. scripts/ingest.mjs 실행 필요.</div>;
  }
  return (
    <ul className="kb-list" data-testid="sources-list">
      {result.data.map((s: RagSource) => {
        const active = selectedId === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              className={active ? "kb-item kb-item-active" : "kb-item"}
              aria-pressed={active}
              onClick={() => onSelect(s.id)}
            >
              <div className="kb-item-title">{s.title}</div>
              <div className="kb-item-meta">
                <code>id: {s.id}</code> · chunks: {s.chunks} · updated: {formatTs(s.updated_at)}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function formatTs(ts: string): string {
  const t = Date.parse(ts);
  return Number.isNaN(t) ? ts : new Date(t).toLocaleString("ko-KR");
}
