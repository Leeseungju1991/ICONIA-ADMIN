"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { RagSource } from "@/lib/api/rag";
import type { ServerResult } from "@/lib/types";

// 소스 목록 패널 — 서버측 listRagSources 결과(ServerResult)를 props 로 받아 렌더.
// 선택 시 onSelect 콜백으로 상위(KnowledgeConsole)에 알림.
// IMPORTANT: 활성 버튼 className 에 "kb-item-active" 토큰 유지 — page.test.tsx 가
//            `btn.className.toContain("kb-item-active")` 로 검증.

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
    return (
      <Alert severity="error">
        {result.code}: {result.message}
      </Alert>
    );
  }
  if (result.data.length === 0) {
    return (
      <Alert severity="info" variant="outlined">
        등록된 소스 없음. scripts/ingest.mjs 실행 필요.
      </Alert>
    );
  }
  return (
    <Stack component="ul" spacing={1} data-testid="sources-list" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {result.data.map((s: RagSource) => {
        const active = selectedId === s.id;
        return (
          <Box component="li" key={s.id} sx={{ m: 0, p: 0 }}>
            <ButtonBase
              component="button"
              type="button"
              className={active ? "kb-item kb-item-active" : "kb-item"}
              aria-pressed={active}
              onClick={() => onSelect(s.id)}
              sx={{
                display: "block",
                width: "100%",
                textAlign: "left",
                p: 1.5,
                borderRadius: 1,
                border: 1,
                borderColor: active ? "primary.main" : "divider",
                backgroundColor: active ? "rgba(26,115,232,0.06)" : "transparent",
                transition: "all 120ms ease",
                "&:hover": {
                  backgroundColor: active ? "rgba(26,115,232,0.1)" : "rgba(0,0,0,0.03)",
                },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {s.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                <Box component="code" sx={{ fontSize: "0.6875rem" }}>id: {s.id}</Box>
                {" · "}chunks: {s.chunks}
                {" · "}updated: {formatTs(s.updated_at)}
              </Typography>
            </ButtonBase>
          </Box>
        );
      })}
    </Stack>
  );
}

function formatTs(ts: string): string {
  const t = Date.parse(ts);
  return Number.isNaN(t) ? ts : new Date(t).toLocaleString("ko-KR");
}
