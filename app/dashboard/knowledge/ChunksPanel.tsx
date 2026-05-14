"use client";

// 청크 패널 — 선택된 sourceId 가 바뀌면 getChunksAction(sourceId) 을 useTransition 으로 호출,
// 반환된 RagChunk[] 를 렌더. snake_case 필드(location.page) 그대로 표시.

import { useEffect, useState, useTransition } from "react";
import { getChunksAction } from "./actions";
import type { RagChunk } from "@/lib/api/rag";

export function ChunksPanel({ sourceId }: { sourceId?: string }) {
  const [chunks, setChunks] = useState<RagChunk[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!sourceId) {
      setChunks([]);
      setError(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await getChunksAction(sourceId);
      if (r.ok) {
        setChunks(r.data);
        setError(null);
      } else {
        setChunks([]);
        setError(`${r.code}: ${r.message}`);
      }
    });
  }, [sourceId]);

  if (!sourceId) return <div className="empty">왼쪽에서 소스를 선택하세요.</div>;
  if (pending) return <div className="empty">불러오는 중…</div>;
  if (error) return <div className="error">{error}</div>;
  if (chunks.length === 0) return <div className="empty">청크 없음.</div>;

  return (
    <ul className="kb-list" data-testid="chunks-list">
      {chunks.map((c: RagChunk) => (
        <li key={c.id} className="kb-chunk">
          <div className="kb-item-meta">
            <code>{c.id}</code>
            {c.location?.page != null ? <> · page {c.location.page}</> : null}
          </div>
          <pre className="kb-chunk-text">{c.text}</pre>
        </li>
      ))}
    </ul>
  );
}
