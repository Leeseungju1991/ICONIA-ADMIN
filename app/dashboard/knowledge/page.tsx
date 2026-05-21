"use client";

import { useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";

// V1.0 #4 — RAG·대화 품질 검수 화면.
//
// Server 측 endpoint (이미 구현됨):
//   POST /api/v1/admin/rag/test-query     — 운영자가 테스트 질의를 보내 답변/출처 확인
//   GET  /api/v1/admin/rag/sources        — 인덱싱된 출처 카탈로그
//   GET  /api/v1/admin/rag/sources/:id/chunks  — 청크 보기
//   GET  /api/v1/admin/rag/feedback       — 사용자 피드백 목록 (verdict 별)
//
// 본 페이지는 그 4개 엔드포인트를 한 화면에서 운용한다.
// TODO(server-wire-up): lib/api/rag.ts 의 함수들과 lib/actions/rag.ts (신설 예정)
// server action 으로 wiring. 본 라운드는 진입 화면 스켈레톤 + Server endpoint 가
// 도달 가능한지 확인하는 ping UI 만 둔다.

export default function KnowledgePage() {
  const [pingState, setPingState] = useState<"idle" | "ok" | "fail">("idle");
  const [isPending, startTransition] = useTransition();

  function pingRag() {
    startTransition(async () => {
      try {
        const r = await fetch("/api/knowledge/ping", { method: "GET", credentials: "include" });
        setPingState(r.ok ? "ok" : "fail");
      } catch {
        setPingState("fail");
      }
    });
  }

  return (
    <div className="space-y-4">
      <PanelCard
        title="RAG·대화 품질"
        description="질의 테스트 · 출처 검수 · 사용자 피드백을 한 화면에서 관리합니다."
      >
        <div className="text-sm text-muted">
          본 화면은 V1.0 #4 (RAG/대화 품질 관리) 의 진입점입니다. Server 측
          {" "}<code className="font-mono text-xs">/api/v1/admin/rag/*</code> 엔드포인트가
          이미 구현되어 있어, 다음 라운드에 테스트 질의 · 출처 카탈로그 · 피드백
          목록을 wiring 합니다.
        </div>
      </PanelCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PanelCard title="① 테스트 질의">
          <div className="text-sm text-muted">
            운영자가 임의 질의를 입력하면 PersonaClient 가 RAG 컨텍스트를 함께 호출하여
            (a) 최종 답변, (b) 사용된 청크, (c) latency 를 표시합니다.
          </div>
          <button
            type="button"
            disabled
            className="mt-3 rounded-2xl bg-white/60 px-4 py-2 text-sm text-muted shadow-card"
          >
            wiring 예정
          </button>
        </PanelCard>
        <PanelCard title="② 출처 카탈로그">
          <div className="text-sm text-muted">
            인덱싱된 SOUL/지식 출처를 목록으로 보고, 청크별로 펼쳐 검수합니다.
            인덱스 변경 시 운영자가 즉시 영향 범위를 확인합니다.
          </div>
          <button
            type="button"
            disabled
            className="mt-3 rounded-2xl bg-white/60 px-4 py-2 text-sm text-muted shadow-card"
          >
            wiring 예정
          </button>
        </PanelCard>
        <PanelCard title="③ 사용자 피드백">
          <div className="text-sm text-muted">
            사용자가 답변에 남긴 verdict (만족/부정확/유해) 를 모아 보여줍니다.
            반복 부정 피드백이 같은 출처에서 나오면 그 출처를 비활성화합니다.
          </div>
          <button
            type="button"
            disabled
            className="mt-3 rounded-2xl bg-white/60 px-4 py-2 text-sm text-muted shadow-card"
          >
            wiring 예정
          </button>
        </PanelCard>
      </div>

      <PanelCard title="연결 상태 점검 (개발 보조)">
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={pingRag}
            disabled={isPending}
            className="rounded-2xl bg-accent px-4 py-2 text-white shadow-card disabled:opacity-60"
          >
            {isPending ? "확인 중..." : "RAG endpoint 도달 확인"}
          </button>
          {pingState === "ok" ? <span className="chip chip-success">도달</span> : null}
          {pingState === "fail" ? <span className="chip chip-warn">미도달 (route handler 필요)</span> : null}
        </div>
        <div className="mt-2 text-xs text-muted">
          본 ping 은 임시 진단용입니다. 라운드 2 에서 server action 으로 교체됩니다.
        </div>
      </PanelCard>
    </div>
  );
}
