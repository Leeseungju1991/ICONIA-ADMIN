"use client";

import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Grid from "@mui/material/Grid";
import type { RagSource } from "@/lib/api/rag";
import type { ServerResult } from "@/lib/types";
import { SourcesPanel } from "./SourcesPanel";
import { ChunksPanel } from "./ChunksPanel";
import { QueryPanel } from "./QueryPanel";

// Knowledge Console 클라이언트 래퍼 — 3패널 공유 상태(selectedSourceId)를 들고
// SourcesPanel / ChunksPanel / QueryPanel 을 렌더한다.

export function KnowledgeConsole({ sourcesResult }: { sourcesResult: ServerResult<RagSource[]> }) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | undefined>(undefined);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} lg={4}>
        <Card sx={{ height: "100%" }}>
          <CardHeader title="소스" subheader="등록된 RAG 인덱스" />
          <CardContent>
            <SourcesPanel
              result={sourcesResult}
              selectedId={selectedSourceId}
              onSelect={setSelectedSourceId}
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} lg={4}>
        <Card sx={{ height: "100%" }}>
          <CardHeader title="청크" subheader="선택된 소스의 chunk 목록" />
          <CardContent>
            <ChunksPanel sourceId={selectedSourceId} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} lg={4}>
        <Card sx={{ height: "100%" }}>
          <CardHeader title="쿼리 테스트" subheader="질문 → answer + citations" />
          <CardContent>
            <QueryPanel />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
