"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { OpsAuditTrailPanel } from "../_components/OpsAuditTrailPanel";
import { mockPersonas, formatDate, type PersonaRow } from "@/lib/mockData";
import { mockOpsActions, OPS_KIND_LABEL } from "@/lib/mockOpsActions";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";
import { listPersonasAction, type ListPersonasResult } from "@/lib/actions/personas";

// AI 페르소나 관리 — SOUL 파일 업로드 / 검수 / 라이브 전환 / 롤백.
// 데모 mock. 백엔드 연동 시 lib/adminApi.ts 로 교체.

const stateInfo: Record<PersonaRow["state"], { label: string; chip: string }> = {
  live: { label: "라이브", chip: "chip chip-success" },
  staged: { label: "검수 중", chip: "chip chip-info" },
  draft: { label: "초안", chip: "chip chip-muted" },
  archived: { label: "보관", chip: "chip chip-warn" },
};

const languageLabel: Record<PersonaRow["language"], string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
};

function formatSize(b: number): string {
  if (b > 1_000_000) return `${(b / 1_000_000).toFixed(2)} MB`;
  if (b > 1000) return `${(b / 1000).toFixed(1)} KB`;
  return `${b} B`;
}

export default function PersonasPage() {
  const [state, setState] = useState<"all" | PersonaRow["state"]>("all");
  const [lang, setLang] = useState<"all" | PersonaRow["language"]>("all");
  const [picked, setPicked] = useState<PersonaRow | null>(null);
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [auditTick, setAuditTick] = useState(0);

  const failedPersonaOps = mockOpsActions.filter(
    (a) =>
      (a.kind === "persona_go_live" || a.kind === "persona_rollback") &&
      (a.status === "failed" || a.status === "queued"),
  );

  async function retryFailedOp(target_id: string, target_label: string, action: string) {
    const reason = window.prompt(`${action} 재시도 사유 (5자 이상, 감사 로그에 기록).`);
    if (!reason || reason.trim().length < 5) {
      setToast("사유가 5자 이상 필요합니다.");
      return;
    }
    const result = await recordOpsAuditWithSilentRetry({
      action: `persona.${action}_retry`,
      target_label,
      target_id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "queued",
    });
    setAuditTick((t) => t + 1);
    if (result.ok) {
      setToast(`${action} 재시도를 audit trail 에 기록했습니다. (대상: ${target_label})`);
    } else {
      setToast(
        `${action} 재시도 큐 적재 최종 실패 — 운영자 확인 필요. (대상: ${target_label}) [${result.attempts}회 시도]`,
      );
    }
  }

  const filtered = useMemo(
    () =>
      mockPersonas.filter((p) => {
        if (state !== "all" && p.state !== state) return false;
        if (lang !== "all" && p.language !== lang) return false;
        return true;
      }),
    [state, lang],
  );

  const stats = useMemo(() => {
    const live = mockPersonas.filter((p) => p.state === "live").length;
    const staged = mockPersonas.filter((p) => p.state === "staged").length;
    const sessions = mockPersonas.reduce((s, p) => s + p.active_sessions, 0);
    return { total: mockPersonas.length, live, staged, sessions };
  }, []);

  const columns: Column<PersonaRow>[] = [
    {
      key: "name",
      header: "페르소나",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-800">{r.display_label}</div>
          <div className="text-[11px] text-muted font-mono">{r.name}</div>
        </div>
      ),
    },
    { key: "state", header: "상태", render: (r) => <span className={stateInfo[r.state].chip}>{stateInfo[r.state].label}</span> },
    { key: "lang", header: "언어", render: (r) => <span className="chip chip-muted">{languageLabel[r.language]}</span> },
    { key: "ver", header: "버전", render: (r) => <span className="font-mono text-xs">{r.version}</span> },
    { key: "voice", header: "TTS Voice", render: (r) => <span className="font-mono text-xs text-slate-700">{r.voice_id}</span> },
    { key: "size", header: "SOUL", align: "right", render: (r) => <span className="text-xs text-slate-700">{formatSize(r.soul_size_bytes)}</span> },
    { key: "sessions", header: "활성 세션", align: "right", render: (r) => r.active_sessions.toLocaleString() },
    { key: "updated", header: "최근 수정", render: (r) => <span className="text-xs text-muted">{formatDate(r.updated_at)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button className="btn-outline text-xs" type="button" onClick={() => setPicked(r)}>상세</button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="등록 페르소나" value={String(stats.total)} hint="아카이브 포함" accent="purple" />
        <StatCard label="라이브" value={String(stats.live)} hint="현재 서비스 중" accent="teal" />
        <StatCard label="검수 중" value={String(stats.staged)} hint="라이브 전환 대기" accent="orange" />
        <StatCard label="활성 세션" value={stats.sessions.toLocaleString()} hint="현재 대화 중" accent="pink" />
      </section>

      <LivePersonaStatus />

      <PanelCard
        title="페르소나 목록"
        description="SOUL 파일 + TTS voice + 시스템 프롬프트로 구성된 AI 페르소나를 관리합니다. 라이브 전환은 staged → live 단방향."
        actions={
          <>
            <select
              className="select max-w-[140px]"
              value={state}
              onChange={(e) => setState(e.target.value as typeof state)}
            >
              <option value="all">전체 상태</option>
              <option value="live">라이브</option>
              <option value="staged">검수 중</option>
              <option value="draft">초안</option>
              <option value="archived">보관</option>
            </select>
            <select
              className="select max-w-[120px]"
              value={lang}
              onChange={(e) => setLang(e.target.value as typeof lang)}
            >
              <option value="all">전체 언어</option>
              <option value="ko">한국어</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
            <button className="btn-primary text-sm" type="button" onClick={() => setComposing(true)}>
              + 새 페르소나
            </button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="조건에 맞는 페르소나가 없습니다." />
      </PanelCard>

      <PanelCard
        title="실패한 페르소나 운영자 액션"
        description="라이브 전환 / 롤백 실패 / 대기 항목. 재시도는 세션 audit trail 에 기록."
      >
        {failedPersonaOps.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            실패한 페르소나 운영자 액션이 없습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {failedPersonaOps.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl bg-white/55 border border-white/60 px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={r.status === "failed" ? "chip chip-error" : "chip chip-info"}>
                      {r.status === "failed" ? "실패" : "대기"}
                    </span>
                    <span className="chip chip-muted">{OPS_KIND_LABEL[r.kind]}</span>
                    <span className="font-mono text-xs text-slate-700 truncate max-w-[220px]">
                      {r.target_label}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    {r.failure_reason ?? "대기 중"} · 재시도 {r.retry_count}회
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="btn-outline text-xs"
                    type="button"
                    onClick={() =>
                      retryFailedOp(
                        r.target_id,
                        r.target_label,
                        r.kind === "persona_go_live" ? "go_live" : "rollback",
                      )
                    }
                  >
                    재시도
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <OpsAuditTrailPanel
        prefix="persona."
        title="페르소나 운영자 액션 audit (세션)"
        description="라이브 전환·롤백·검수 제출 등 운영자 액션 기록. 백엔드 연동 후 Server audit_log 와 머지."
        refresh={{ tick: auditTick }}
      />

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card">
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">닫기</button>
        </div>
      ) : null}

      {composing ? <ComposerModal onClose={() => setComposing(false)} onToast={setToast} /> : null}
      {picked ? (
        <PersonaDrawer
          persona={picked}
          onClose={() => setPicked(null)}
          onToast={setToast}
          onActionRecorded={() => setAuditTick((t) => t + 1)}
        />
      ) : null}
    </div>
  );
}

function ComposerModal({ onClose, onToast }: { onClose: () => void; onToast: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [language, setLanguage] = useState<PersonaRow["language"]>("ko");
  const [description, setDescription] = useState("");

  function submit() {
    if (!name.trim() || !label.trim()) {
      onToast("이름(코드)과 표시명을 모두 입력하세요.");
      return;
    }
    onToast(`페르소나 ${label} (${name}) 생성 요청을 기록했습니다. (백엔드 연동 후 활성화)`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/30">
      <div className="w-full max-w-lg glass-panel rounded-3xl p-6 relative">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">새 페르소나 등록</h3>
        <p className="text-xs text-muted">SOUL(.soul/.json) 파일 + TTS voice + 메타데이터.</p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-600">
            SOUL 파일
            <input className="input mt-1" type="file" accept=".soul,.json,.yaml,.yml" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-600">
              이름 (코드)
              <input
                className="input mt-1"
                placeholder="예: lumi"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block text-xs text-slate-600">
              표시명
              <input
                className="input mt-1"
                placeholder="예: 루미"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-600">
              언어
              <select
                className="select mt-1"
                value={language}
                onChange={(e) => setLanguage(e.target.value as PersonaRow["language"])}
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              TTS Voice ID
              <input className="input mt-1" placeholder="예: tts_ko_lumi_v2" />
            </label>
          </div>
          <label className="block text-xs text-slate-600">
            설명
            <textarea
              className="input mt-1 min-h-[80px]"
              placeholder="페르소나 톤·성격·용도"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose}>취소</button>
          <button className="btn-primary text-sm" type="button" onClick={submit}>초안 저장</button>
        </div>
      </div>
    </div>
  );
}

function PersonaDrawer({
  persona,
  onClose,
  onToast,
  onActionRecorded,
}: {
  persona: PersonaRow;
  onClose: () => void;
  onToast: (msg: string) => void;
  onActionRecorded: () => void;
}) {
  async function runAction(label: string, actionCode: string) {
    const reason = window.prompt(`${label} 사유를 입력하세요 (감사 로그에 기록됩니다, 5자 이상).`);
    if (!reason || reason.trim().length < 5) {
      onToast("사유가 5자 이상 필요합니다.");
      return;
    }
    const result = await recordOpsAuditWithSilentRetry({
      action: `persona.${actionCode}`,
      target_label: `${persona.display_label} (${persona.version})`,
      target_id: persona.id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "queued",
    });
    onActionRecorded();
    if (result.ok) {
      onToast(`${label} 요청을 audit trail 에 기록했습니다.`);
    } else {
      onToast(`${label} 최종 실패 — 운영자 확인 필요. [${result.attempts}회 시도]`);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/30">
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 relative">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">페르소나 상세</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{persona.name} ({persona.version})</p>

        <dl className="mt-5 space-y-3 text-sm">
          <Row k="표시명" v={persona.display_label} />
          <Row k="상태" v={<span className={stateInfo[persona.state].chip}>{stateInfo[persona.state].label}</span>} />
          <Row k="언어" v={languageLabel[persona.language]} />
          <Row k="TTS Voice" v={<span className="font-mono text-xs">{persona.voice_id}</span>} />
          <Row k="SOUL 크기" v={formatSize(persona.soul_size_bytes)} />
          <Row k="활성 세션" v={persona.active_sessions.toLocaleString()} />
          <Row k="최근 수정" v={formatDate(persona.updated_at)} />
          <Row k="게시일" v={persona.published_at ? formatDate(persona.published_at) : "미게시"} />
        </dl>

        <div className="rounded-xl bg-white/60 border border-white/60 p-3 mt-3">
          <div className="text-xs text-muted mb-1">설명</div>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{persona.description}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-outline text-sm" type="button" onClick={() => runAction("SOUL 다운로드", "soul_download")}>SOUL 다운로드</button>
          <button className="btn-outline text-sm" type="button" onClick={() => runAction("프롬프트 편집", "prompt_edit")}>프롬프트 편집</button>
          {persona.state === "draft" ? (
            <button className="btn-outline text-sm" type="button" onClick={() => runAction("검수로 이동", "submit_review")}>검수 제출</button>
          ) : null}
          {persona.state === "staged" ? (
            <button className="btn-primary text-sm" type="button" onClick={() => runAction("라이브 전환", "go_live")}>라이브 전환</button>
          ) : null}
          {persona.state === "live" ? (
            <button className="btn-danger text-sm" type="button" onClick={() => runAction("라이브 회수(아카이브)", "archive")}>라이브 회수</button>
          ) : null}
          {persona.state === "archived" ? (
            <button className="btn-outline text-sm" type="button" onClick={() => runAction("복원", "restore")}>복원</button>
          ) : null}
        </div>
        <p className="text-[11px] text-muted mt-3">※ 라이브 전환은 staged 상태에서만 가능합니다. 데모 환경 — 액션은 감사 로그만 기록됩니다.</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="text-sm text-slate-800 font-medium">{v}</dd>
    </div>
  );
}

// V1.0 #3 — Server `/api/v1/admin/personas` 실시간 카탈로그.
// 본 카드는 mockPersonas 와 독립적으로 동작 — Server 가 ok 면 실 데이터, 아니면 안내.
function LivePersonaStatus() {
  const [state, setState] = useState<ListPersonasResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPersonasAction()
      .then((r) => setState(r))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <PanelCard title="실시간 페르소나 상태" description="Server /api/v1/admin/personas 조회 중...">
        <div className="text-sm text-muted">불러오는 중</div>
      </PanelCard>
    );
  }
  if (!state || !state.ok) {
    return (
      <PanelCard
        title="실시간 페르소나 상태"
        description="Server /api/v1/admin/personas (PersonaClient.listCatalog + aiHealthTracker 결합)"
      >
        <div className="text-sm text-muted">
          Server 도달 실패{state && !state.ok ? ` (${state.code ?? "ERR"}): ${state.message}` : ""}.
          아래 mock 카탈로그를 임시 표시합니다.
        </div>
      </PanelCard>
    );
  }
  if (state.personas.length === 0) {
    return (
      <PanelCard
        title="실시간 페르소나 상태"
        description="Server /api/v1/admin/personas 응답 — 카탈로그 비어 있음"
      >
        {state.catalog_error ? (
          <div className="text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
            ⚠ AI 카탈로그 호출 오류: {state.catalog_error.code} — {state.catalog_error.message}
          </div>
        ) : (
          <div className="text-sm text-muted">AI 서비스에 등록된 SOUL 이 없습니다.</div>
        )}
      </PanelCard>
    );
  }
  return (
    <PanelCard
      title="실시간 페르소나 상태"
      description="Server /api/v1/admin/personas — PersonaClient.listCatalog + aiHealthTracker SOUL 분해"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {state.personas.map((p) => (
          <div
            key={p.soul_catalog_id}
            className="rounded-xl border border-white/60 bg-white/60 px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-800">{p.name}</div>
              <span
                className={
                  p.status === "live"
                    ? "chip chip-success"
                    : p.status === "staged"
                      ? "chip chip-info"
                      : "chip chip-muted"
                }
              >
                {p.status}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-muted font-mono">{p.soul_catalog_id}</div>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span>
                fallback{" "}
                <span
                  className={
                    typeof p.fallback_rate === "number" && p.fallback_rate > 0.1
                      ? "text-red-600"
                      : "text-slate-700"
                  }
                >
                  {typeof p.fallback_rate === "number"
                    ? `${(p.fallback_rate * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </span>
              <span className="text-muted">
                last {p.last_response_ts ?? "—"}
              </span>
            </div>
          </div>
        ))}
      </div>
      {state.catalog_error ? (
        <div className="mt-3 text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
          ⚠ AI 카탈로그 일부 누락: {state.catalog_error.code} — {state.catalog_error.message}
        </div>
      ) : null}
    </PanelCard>
  );
}
