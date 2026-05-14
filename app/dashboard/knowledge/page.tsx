import { readSession } from "@/lib/authCookie";
import { listRagSources, type RagSource } from "@/lib/api/rag";
import type { ServerResult } from "@/lib/types";
import { KnowledgeConsole } from "./KnowledgeConsole";

// Knowledge Base 콘솔 — async Server Component (다른 dashboard 페이지와 동일 패턴):
// readSession() → 서버측 listRagSources({jwt}) → 결과를 'use client' 래퍼(KnowledgeConsole)에 넘김.
// 동적 작업(chunk 조회, test-query)은 ./actions.ts 의 Server Action 으로 — 거기서 readSession() 을 자체 호출.
// 브라우저→Server fetch 없음, credentials:'include' 없음, NEXT_PUBLIC_* 없음.

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const jwt = readSession()!; // /dashboard/* 는 middleware + layout 에서 이미 auth gating (ai-health/page.tsx 와 동일)
  const sourcesResult: ServerResult<RagSource[]> = await listRagSources({ jwt });

  return (
    <div className="page">
      <h1>Knowledge Base</h1>
      <p className="muted">제품 문서 인덱스 조회 및 쿼리 테스트 (read-only · admin RAG 라우트).</p>
      <KnowledgeConsole sourcesResult={sourcesResult} />
    </div>
  );
}
