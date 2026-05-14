"use client";

// Knowledge Console 클라이언트 래퍼 — 3패널 공유 상태(selectedSourceId)를 들고
// SourcesPanel / ChunksPanel / QueryPanel 을 렌더한다. 서버측 데이터(sourcesResult)는 props 로 받음.
// Server Action(getChunksAction / testQueryAction)은 각 패널이 직접 import 해서 useTransition 으로 호출.

import { useState } from "react";
import type { RagSource } from "@/lib/api/rag";
import type { ServerResult } from "@/lib/types";
import { SourcesPanel } from "./SourcesPanel";
import { ChunksPanel } from "./ChunksPanel";
import { QueryPanel } from "./QueryPanel";

export function KnowledgeConsole({ sourcesResult }: { sourcesResult: ServerResult<RagSource[]> }) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>(undefined);

  return (
    <div className="kb-grid">
      <section className="kb-panel">
        <h2 className="kb-panel-title">소스</h2>
        <SourcesPanel result={sourcesResult} selectedId={selectedSourceId} onSelect={setSelectedSourceId} />
      </section>
      <section className="kb-panel">
        <h2 className="kb-panel-title">청크</h2>
        <ChunksPanel sourceId={selectedSourceId} />
      </section>
      <section className="kb-panel">
        <h2 className="kb-panel-title">쿼리 테스트</h2>
        <QueryPanel />
      </section>
    </div>
  );
}
