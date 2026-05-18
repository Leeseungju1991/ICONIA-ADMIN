import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { readSession } from "@/lib/authCookie";
import { listRagSources, type RagSource } from "@/lib/api/rag";
import type { ServerResult } from "@/lib/types";
import { KnowledgeConsole } from "./KnowledgeConsole";

// Knowledge Base 콘솔 — async Server Component:
// readSession() → 서버측 listRagSources({jwt}) → 결과를 'use client' 래퍼(KnowledgeConsole)에 넘김.
// 동적 작업(chunk 조회, test-query)은 ./actions.ts 의 Server Action 으로.

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const jwt = readSession()!;
  const sourcesResult: ServerResult<RagSource[]> = await listRagSources({ jwt });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Knowledge Base
        </Typography>
        <Typography variant="body2" color="text.secondary">
          제품 문서 인덱스 조회 및 쿼리 테스트 (read-only · admin RAG 라우트).
        </Typography>
      </Box>
      <KnowledgeConsole sourcesResult={sourcesResult} />
    </Box>
  );
}
