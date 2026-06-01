"use client";
import type { User360Snapshot } from "@/lib/mockUser360";
import type { OperatorRole } from "@/lib/operatorRoles";

// 권한 위계 (낮은 순서 → 높은 순서). operatorRoles.ts 의 OperatorRole 정의와 일치.
const ORDER: OperatorRole[] = ["viewer", "cs", "secops", "sre", "superadmin"];
function rank(r: OperatorRole): number { return ORDER.indexOf(r); }
function allow(role: OperatorRole, min: OperatorRole): boolean { return rank(role) >= rank(min); }

export type ActionKey =
  | "force_logout" | "suspend" | "reset_mfa" | "force_reauth"
  | "force_unpair" | "ota_channel" | "as_ticket"
  | "fallback_toggle" | "persona_reset"
  | "test_push";

// 서버가 빈/0 데이터를 반환해도 렌더가 깨지지 않도록 방어적 헬퍼.
// (User360Snapshot 타입은 server 와 정합하지만, 일부 도메인이 비어 있는 신규
//  사용자의 경우 sub-object 가 비거나 null/undefined 일 수 있다.)
function safeDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function UserSnapshotGrid({ snapshot, role, onAction }: {
  snapshot: User360Snapshot;
  role: OperatorRole;
  onAction: (key: ActionKey, ctx: { serial?: string }) => void;
}) {
  const devices = snapshot.devices ?? [];
  const server = snapshot.server;
  const ai = snapshot.ai;
  const app = snapshot.app;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* HW */}
      <Card title="HW" subtitle="페어링 디바이스">
        {devices.length === 0 ? (
          <div className="text-xs text-muted">페어링된 디바이스가 없습니다.</div>
        ) : null}
        {devices.map((d) => (
          <div key={d.serial} className="rounded-xl border border-slate-200 p-3 mb-2 last:mb-0">
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs">{d.serial}</div>
              <span className={`chip ${d.online ? "chip-success" : "chip-muted"}`}>{d.online ? "online" : "offline"}</span>
            </div>
            <div className="text-[11px] text-muted mt-1">FW {d.firmware_version} · 배터리 {d.battery_pct}% · last {safeDate(d.last_seen)}</div>
            <div className="mt-2 flex gap-2 flex-wrap">
              <ActionBtn label="OTA 채널 강제" disabled={!allow(role, "sre")} onClick={() => onAction("ota_channel", { serial: d.serial })} />
              <ActionBtn label="force-unpair" tone="danger" disabled={!allow(role, "secops")} onClick={() => onAction("force_unpair", { serial: d.serial })} />
              <ActionBtn label="AS 티켓" disabled={!allow(role, "cs")} onClick={() => onAction("as_ticket", { serial: d.serial })} />
            </div>
          </div>
        ))}
      </Card>

      {/* Server */}
      <Card title="Server" subtitle="계정 · 세션">
        <KV k="활성 세션" v={server ? String(server.active_sessions ?? 0) : "—"} />
        <KV k="24h refresh token" v={server ? String(server.refresh_tokens_24h ?? 0) : "—"} />
        <KV k="rate limit" v={server?.rate_limit_state ?? "—"} />
        <KV k="PIPA 동의" v={server?.pipa_consent_version ?? "—"} />
        <div className="mt-3 flex gap-2 flex-wrap">
          <ActionBtn label="강제 로그아웃" disabled={!allow(role, "cs")} onClick={() => onAction("force_logout", {})} />
          <ActionBtn label="계정 일시정지" tone="danger" disabled={!allow(role, "secops")} onClick={() => onAction("suspend", {})} />
          <ActionBtn label="MFA 초기화" disabled={!allow(role, "secops")} onClick={() => onAction("reset_mfa", {})} />
        </div>
      </Card>

      {/* AI */}
      <Card title="AI" subtitle="페르소나">
        <KV k="페르소나" v={ai ? `${ai.persona_name ?? "—"} ${ai.persona_version ?? ""}`.trim() : "—"} />
        <KV k="24h fallback" v={ai ? `${((ai.fallback_rate_24h ?? 0) * 100).toFixed(2)}%` : "—"} />
        <KV k="평균 지연" v={ai ? `${ai.avg_latency_ms ?? 0} ms` : "—"} />
        <KV k="컨텍스트 압축" v={ai ? `${ai.compression_events_24h ?? 0}회` : "—"} />
        <div className="mt-3 flex gap-2 flex-wrap">
          <ActionBtn label="fallback 강제 ON" disabled={!allow(role, "sre")} onClick={() => onAction("fallback_toggle", {})} />
          <ActionBtn label="persona 리셋" tone="danger" disabled={!allow(role, "superadmin")} onClick={() => onAction("persona_reset", {})} />
        </div>
      </Card>

      {/* APP */}
      <Card title="APP" subtitle="모바일">
        <KV k="앱 버전" v={app?.app_version ?? "—"} />
        <KV k="OS / 모델" v={app ? `${app.os ?? "—"} · ${app.model ?? "—"}` : "—"} />
        <KV k="마지막 푸시" v={safeDate(app?.last_push_at)} />
        {app?.last_crash ? (
          <div className="mt-2 rounded-lg bg-red-50 border border-red-200 p-2 text-[11px] text-red-700">
            <div className="font-semibold">{app.last_crash.type}</div>
            <div className="truncate">{app.last_crash.message}</div>
            <div className="opacity-75">{safeDate(app.last_crash.at)}</div>
          </div>
        ) : null}
        <div className="mt-3 flex gap-2 flex-wrap">
          <ActionBtn label="테스트 푸시" disabled={!allow(role, "cs")} onClick={() => onAction("test_push", {})} />
          <ActionBtn label="강제 재인증" tone="danger" disabled={!allow(role, "secops")} onClick={() => onAction("force_reauth", {})} />
        </div>
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="text-[11px] text-muted">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between py-1 text-sm"><span className="text-muted">{k}</span><span className="font-medium text-slate-800">{v}</span></div>;
}
function ActionBtn({ label, onClick, tone = "default", disabled }: { label: string; onClick: () => void; tone?: "default" | "danger"; disabled?: boolean }) {
  const cls = tone === "danger"
    ? "border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
    : "border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-lg border bg-white px-3 py-1.5 text-xs ${cls}`}>{label}</button>;
}
