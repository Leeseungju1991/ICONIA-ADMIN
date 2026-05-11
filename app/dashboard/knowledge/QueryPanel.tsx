"use client";

// 쿼리 테스트 패널 — textarea + backend override 토글 + "실행" 버튼.
// testQueryAction({question, backendOverride}) 을 useTransition 으로 호출,
// 반환된 RagQueryData(answer / citations / backend / latency_ms) 를 렌더. snake_case 그대로.

import { useState, useTransition } from "react";
import { testQueryAction } from "./actions";
import type { RagQueryData } from "@/lib/api/rag";

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
    <form onSubmit={onSubmit} data-testid="query-panel">
      <div className="form-row">
        <label htmlFor="kb-q">질문</label>
        <textarea
          id="kb-q"
          rows={3}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예: ICONIA 보증 기간은?"
        />
      </div>
      <div className="form-row">
        <label htmlFor="kb-backend">backend override</label>
        <select id="kb-backend" value={backend} onChange={(e) => setBackend(e.target.value as BackendChoice)}>
          <option value="">기본(env)</option>
          <option value="mock">mock</option>
          <option value="bedrock">bedrock</option>
        </select>
      </div>
      <button type="submit" className="btn" disabled={disabled} aria-busy={pending}>
        {pending ? "실행 중…" : "실행"}
      </button>

      {error ? <div className="error" style={{ marginTop: 14 }}>{error}</div> : null}

      {result ? (
        <div className="kb-result" data-testid="query-result" style={{ marginTop: 14 }}>
          <div className="kb-item-meta">
            backend: {result.backend} · {result.latency_ms}ms · citations: {result.citations.length}
            {result.truncated ? " · truncated" : ""}
            {result.session_id ? <> · session_id: <code>{result.session_id}</code></> : null}
          </div>
          <pre className="kb-chunk-text">{result.answer}</pre>
          {result.citations.length > 0 ? (
            <details>
              <summary>citations ({result.citations.length})</summary>
              <ul className="kb-list">
                {result.citations.map((c, i) => (
                  <li key={`${c.source_id}-${i}`} className="kb-chunk">
                    <div className="kb-item-meta">
                      <code>{c.source_id}</code> · score {c.score}
                      {c.location?.page != null ? <> · page {c.location.page}</> : null}
                      {c.location?.section ? <> · {c.location.section}</> : null}
                    </div>
                    <pre className="kb-chunk-text">{c.text}</pre>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
