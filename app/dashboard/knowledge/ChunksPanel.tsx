"use client";

import { useEffect, useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getChunksAction } from "./actions";
import type { RagChunk } from "@/lib/api/rag";

// 청크 패널 — 선택된 sourceId 가 바뀌면 getChunksAction(sourceId) 을 useTransition 으로 호출.

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

  if (!sourceId) {
    return <Alert severity="info" variant="outlined">왼쪽에서 소스를 선택하세요.</Alert>;
  }
  if (pending) {
    return <Alert severity="info" variant="outlined">불러오는 중…</Alert>;
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  if (chunks.length === 0) {
    return <Alert severity="info" variant="outlined">청크 없음.</Alert>;
  }

  return (
    <Stack component="ul" spacing={1.5} data-testid="chunks-list" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {chunks.map((c: RagChunk) => (
        <Box
          component="li"
          key={c.id}
          sx={{
            p: 1.5,
            borderRadius: 1,
            border: 1,
            borderColor: "divider",
            backgroundColor: "background.default",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            <Box component="code" sx={{ fontSize: "0.6875rem" }}>{c.id}</Box>
            {c.location?.page != null ? <> · page {c.location.page}</> : null}
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: "0.8125rem",
              fontFamily: "inherit",
              color: "text.primary",
            }}
          >
            {c.text}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
