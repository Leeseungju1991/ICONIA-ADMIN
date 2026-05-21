"use client";

import { useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";

// V1.0 #7 — CS 1차 응대 통합 조회 화면.
//
// 운영자가 이메일 / 시리얼 / 사용자 UUID / 디바이스 UUID 중 하나를 입력하면
// Server `GET /api/v1/admin/cs/lookup?q=` 가 사용자 · 보유 기기 · 최근 audit ·
// 최근 오류 · 활성 세션 · PIPA 상태를 한 응답으로 반환한다.
//
// 본 페이지는 그 응답을 4분면(사용자/기기/오류/조치) 으로 표시한다.
// Server endpoint 가 아직 wiring 되지 않은 동안에는 fetch 가 ERR_NOT_FOUND 를
// 반환해도 페이지가 깨지지 않도록 graceful fallback 한다.
//
// TODO(server-wire-up): 현재는 임시로 Next route handler `/api/cs/lookup` 에 fetch
// 한다. aws-infra 가 Server `/api/v1/admin/cs/lookup` 추가 완료 후, `lib/actions/cs.ts`
// 에 server action 추가하고 useFormState 로 마이그레이션 (PII 가 URL 에 노출되지
// 않도록 POST 본문 + httpOnly JWT cookie).

type CsLookupResult = {
  user?: {
    id: string;
    email: string | null;
    phone: string | null;
    account_status: string;
    pipa_state?: string;
  } | null;
  devices?: Array<{
    id: string;
    serial: string;
    fw_version: string | null;
    online: boolean;
    last_seen: string | null;
  }>;
  recent_audits?: Array<{
    id: string;
    action: string;
    created_at: string;
    operator_role: string | null;
  }>;
  recent_errors?: Array<{
    id: string;
    kind: string;
    message: string;
    occurred_at: string;
  }>;
  active_session?: {
    ip?: string;
    last_seen?: string;
    location_hint?: string;
  } | null;
};

export default function CsLookupPage() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<CsLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (q.trim().length < 3) {
      setError("검색어는 3자 이상 입력하세요 (이메일/시리얼/UUID).");
      return;
    }
    startTransition(async () => {
      try {
        const r = await fetch(`/api/cs/lookup?q=${encodeURIComponent(q.trim())}`, {
          method: "GET",
          credentials: "include",
        });
        if (r.status === 404) {
          setError("일치하는 사용자 또는 기기가 없습니다.");
          return;
        }
        if (!r.ok) {
          setError("Server 응답 오류 — 잠시 후 다시 시도하세요.");
          return;
        }
        const body = (await r.json()) as CsLookupResult;
        setResult(body);
      } catch {
        setError("네트워크 오류 — 운영 서버에 연결할 수 없습니다.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <PanelCard title="CS 1차 응대 — 통합 조회" description="이메일 · 시리얼 · 사용자/디바이스 UUID 중 하나로 검색">
        <form onSubmit={runLookup} className="flex gap-2">
          <input
            type="text"
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
        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
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
                <Row label="전화" value={result.user.phone ?? "—"} />
                <Row label="계정 상태" value={result.user.account_status} />
                <Row label="PIPA 상태" value={result.user.pipa_state ?? "—"} />
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
                      <span className="font-mono">{d.serial}</span>
                      <span className={d.online ? "chip chip-success" : "chip chip-muted"}>
                        {d.online ? "online" : "offline"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      fw {d.fw_version ?? "—"} · last seen {d.last_seen ?? "—"}
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
                {result.recent_errors.map((e) => (
                  <li key={e.id} className="rounded-xl border border-white/60 bg-white/40 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="chip chip-warn">{e.kind}</span>
                      <span className="text-xs text-muted">{e.occurred_at}</span>
                    </div>
                    <div className="mt-1 text-xs">{e.message}</div>
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
