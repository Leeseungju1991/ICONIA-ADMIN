"use client";

import { useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { csLookupAction, type CsLookupActionResult } from "@/lib/actions/cs";

// V1.0 #7 — CS 1차 응대 통합 조회 화면.
//
// Server `GET /api/v1/admin/cs/lookup?q=` 가 사용자 · 보유 기기 · 최근 audit ·
// 최근 오류 · 활성 세션 · PIPA 상태를 한 응답으로 반환한다.
// JWT 는 server action 에서 httpOnly cookie 로 읽어 클라이언트 노출 차단.

export default function CsLookupPage() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<CsLookupActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function runLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await csLookupAction(fd);
      setState(res);
    });
  }

  const result = state?.ok ? state.result : null;
  const errorMessage = state && !state.ok ? state.message : null;

  return (
    <div className="space-y-4">
      <PanelCard
        title="CS 1차 응대 — 통합 조회"
        description="이메일 · 시리얼 · 사용자/디바이스 UUID 중 하나로 검색"
      >
        <form onSubmit={runLookup} className="flex gap-2">
          <input
            type="text"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="예: user@iconia.example  또는  IC-A1B2C3D4  또는  UUID"
            className="flex-1 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm outline-none focus:border-accent"
            disabled={isPending}
            autoFocus
          />
          <button
            type="submit"
            disabled={isPending || q.trim().length === 0}
            className="rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white shadow-card hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "조회 중..." : "조회"}
          </button>
        </form>
        {errorMessage ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}
        {result?.note ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
            {result.note}
          </div>
        ) : null}
      </PanelCard>

      {result ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PanelCard title="사용자 정보">
            {result.user ? (
              <dl className="space-y-1 text-sm">
                <Row label="UUID" value={result.user.id} mono />
                <Row label="이메일" value={result.user.email ?? "—"} />
                <Row label="계정 상태" value={result.user.account_status ?? "—"} />
                {result.pipa_state ? (
                  <>
                    <Row
                      label="동의 약관 버전"
                      value={result.pipa_state.consent_terms_version ?? "—"}
                    />
                    <Row
                      label="동의 일시"
                      value={result.pipa_state.consent_accepted_at ?? "—"}
                    />
                    {result.pipa_state.pending_deletion_at ? (
                      <Row
                        label="탈퇴 예정"
                        value={result.pipa_state.pending_deletion_at}
                      />
                    ) : null}
                  </>
                ) : null}
                {result.active_session ? (
                  <>
                    <Row label="활성 세션 IP" value={result.active_session.ip ?? "—"} />
                    <Row
                      label="마지막 접속"
                      value={result.active_session.last_seen ?? "—"}
                    />
                  </>
                ) : null}
              </dl>
            ) : (
              <div className="text-sm text-muted">검색어와 일치하는 사용자가 없습니다.</div>
            )}
          </PanelCard>

          <PanelCard title="보유 기기">
            {result.devices && result.devices.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {result.devices.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-xl border border-white/60 bg-white/50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{d.device_id}</span>
                      <span className="chip chip-muted">{d.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      fw {d.firmware_version ?? "—"} · paired {d.paired_at ?? "—"}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted">연결된 기기가 없습니다.</div>
            )}
          </PanelCard>

          <PanelCard title="최근 오류 (10건)">
            {result.recent_errors && result.recent_errors.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {result.recent_errors.map((e, idx) => (
                  <li key={idx} className="rounded-xl border border-white/60 bg-white/40 px-3 py-2">
                    <pre className="text-xs overflow-x-auto">{JSON.stringify(e, null, 2)}</pre>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted">최근 24시간 오류 기록이 없습니다.</div>
            )}
          </PanelCard>

          <PanelCard title="최근 운영자 조치 (10건)">
            {result.recent_audits && result.recent_audits.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {result.recent_audits.map((a) => (
                  <li key={a.id} className="rounded-xl border border-white/60 bg-white/40 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.action}</span>
                      <span className="text-xs text-muted">{a.operator_role ?? "—"}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">{a.created_at}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted">최근 조치 이력이 없습니다.</div>
            )}
          </PanelCard>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : "text-sm"}>{value}</dd>
    </div>
  );
}
