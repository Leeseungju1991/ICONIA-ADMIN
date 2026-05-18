"use client";

import { useState, useTransition } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import { testQueryAction } from "./actions";
import type { RagQueryData } from "@/lib/api/rag";

// 쿼리 테스트 패널 — textarea + backend override 토글 + "실행" 버튼.

type BackendChoice = "" | "mock" | "bedrock";

export function QueryPanel() {
  const [q, setQ] = useState("");
  const [backend, setBackend] = useState<BackendChoice>("");
  const [result, setResult] = useState<RagQueryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const question = q.trim();
  const disabled = pending || question.length === 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.length === 0) return;
    startTransition(async () => {
      const r = await testQueryAction({
        question,
        backendOverride: backend === "" ? undefined : backend,
      });
      if (r.ok) {
        setResult(r.data);
        setError(null);
      } else {
        setResult(null);
        setError(`${r.code}: ${r.message}`);
      }
    });
  };

  return (
    <Box component="form" onSubmit={onSubmit} data-testid="query-panel">
      <Stack spacing={2}>
        <TextField
          id="kb-q"
          label="질문"
          multiline
          minRows={3}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예: ICONIA 보증 기간은?"
          fullWidth
          size="small"
          inputProps={{ "aria-label": "질문" }}
        />
        {/* native <select> 사용 — page.test.tsx 가 fireEvent.change(getByLabelText("backend override")) 로 호출. */}
        <TextField
          select
          id="kb-backend"
          label="backend override"
          value={backend}
          onChange={(e) => setBackend(e.target.value as BackendChoice)}
          fullWidth
          size="small"
          inputProps={{ "aria-label": "backend override" }}
          SelectProps={{ native: true }}
          helperText="현재 슬라이스에서는 서버 설정(RAG_BACKEND)이 우선합니다 — 위 선택은 종단간 no-op. 실제 사용된 백엔드는 응답의 backend 필드로 확인."
        >
          <option value="">기본(env가 결정)</option>
          <option value="mock">mock (현 슬라이스 무효 — env가 우선)</option>
          <option value="bedrock">bedrock (현 슬라이스 무효 — env가 우선)</option>
        </TextField>
        <Button
          type="submit"
          variant="contained"
          className="btn"
          disabled={disabled}
          aria-busy={pending}
          sx={{ alignSelf: "flex-start" }}
        >
          {pending ? "실행 중…" : "실행"}
        </Button>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {result ? (
          <Box data-testid="query-result" sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, backgroundColor: "background.default" }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              backend: {result.backend} · {result.latency_ms}ms · citations: {result.citations.length}
              {result.truncated ? " · truncated" : ""}
              {result.session_id ? (
                <> · session_id: <Box component="code" sx={{ fontSize: "0.6875rem" }}>{result.session_id}</Box></>
              ) : null}
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
              {result.answer}
            </Box>
            {result.citations.length > 0 ? (
              <Accordion disableGutters sx={{ mt: 1.5 }}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined fontSize="small" />}>
                  <Typography variant="body2" color="text.secondary">
                    citations ({result.citations.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: "none" }}>
                    {result.citations.map((c, i) => (
                      <Box
                        component="li"
                        key={`${c.source_id}-${i}`}
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          border: 1,
                          borderColor: "divider",
                          backgroundColor: "background.paper",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                          <Box component="code" sx={{ fontSize: "0.6875rem" }}>{c.source_id}</Box>
                          {" · score "}{c.score}
                          {c.location?.page != null ? <> · page {c.location.page}</> : null}
                          {c.location?.section ? <> · {c.location.section}</> : null}
                        </Typography>
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: "0.8125rem",
                            fontFamily: "inherit",
                          }}
                        >
                          {c.text}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    score는 0~1 코사인 유사도. bedrock 백엔드의 RetrieveAndGenerate는 retrieval score를 제공하지 않을 수 있어 0으로 표기됩니다 — 정상입니다.
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ) : null}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
