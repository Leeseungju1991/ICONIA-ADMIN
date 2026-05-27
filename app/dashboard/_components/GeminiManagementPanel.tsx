// 2026-05-27 — Gemini API Key 운영 가이드 (PDF) 의 운영 매뉴얼을 대시보드에
// 임베드한 패널. 정본 문서: docs/Gemini-API-Key-운영가이드.md (md2pdf 로 PDF 동기화).
//
// 본 컴포넌트는 SSR 가능 (client hooks 없음) — 정적 운영 매뉴얼 표시 + 외부 링크.

import type { ReactNode } from "react";
import Link from "next/link";
import { PanelCard } from "./PanelCard";

type SummaryProps = {
  /** server /keys 에서 받아온 키 개수. 0 이면 "단일 키 모드 가능성" 안내. */
  totalKeys: number;
  /** 활성(active) 키 개수. */
  activeKeys: number;
  /** 95%+ 도달 키 개수 — 즉시 구매/Tier 승급 필요. */
  criticalKeys: number;
  /** Tier 분포 — 사람이 읽기 좋은 한 줄 (예: "free 1 · tier1 2"). */
  tierBreakdown: string;
};

export function GeminiManagementPanel(props: SummaryProps) {
  return (
    <PanelCard
      title="Gemini 키 관리 방안"
      description={`정본: docs/Gemini-API-Key-운영가이드.md — 본 패널은 PDF 운영 매뉴얼의 핵심 절차/체크포인트/비상 대응을 대시보드 안에 임베드합니다.`}
    >
      <div className="space-y-4">
        <CurrentState {...props} />
        <DailyCheckpoints />
        <ScenarioMatrix />
        <DecisionTable />
        <AddKeyProcedure />
        <EmergencyResponse />
      </div>
    </PanelCard>
  );
}

// ── 1. 현재 상태 — 서버 키 개수/티어 기반. ───────────────────────────────
function CurrentState({
  totalKeys,
  activeKeys,
  criticalKeys,
  tierBreakdown,
}: SummaryProps) {
  const looksFreeOnly = totalKeys <= 1;
  return (
    <Section title="1. 현재 상태 (서버 기준)">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Cell label="등록 키" value={String(totalKeys)} hint="GET /api/v1/admin/gemini/keys" />
        <Cell label="활성 키" value={String(activeKeys)} hint="exhausted/cooldown 제외" />
        <Cell
          label="95%+ 키"
          value={String(criticalKeys)}
          hint={criticalKeys > 0 ? "구매/Tier 승급 권장" : "여유"}
          tone={criticalKeys > 0 ? "critical" : "ok"}
        />
        <Cell label="Tier 분포" value={tierBreakdown || "—"} hint="`/keys` 응답 기반" />
      </div>
      {looksFreeOnly ? (
        <Note tone="warn">
          단일 키 운영 중입니다. 베타 테스트 5명 이상 동시 채팅 시 RPM 15회 한도에 즉시
          도달합니다. <strong>결제 활성 + 키 3개</strong> 발급을 권장합니다 (아래 4번 절차).
        </Note>
      ) : null}
    </Section>
  );
}

// ── 2. 매일 5초 체크포인트 ────────────────────────────────────────────
function DailyCheckpoints() {
  return (
    <Section title="2. 매일 5초 체크포인트 (운영자)">
      <p className="text-xs text-muted mb-2">
        4개 카드 중 하나라도 빨강/호박색이면 → 키 추가, Tier 승급, 또는 비상 대응 검토 시점입니다.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Checkpoint
          name="Gemini 키 풀"
          ok="N/N 활성"
          warn="active 0/N · cooldown 키 존재"
          path="/dashboard/ops"
        />
        <Checkpoint
          name="컨텍스트 압축 발동 (5m)"
          ok="< 5%"
          warn="> 5% → SOUL 캐시 점검"
          path="/dashboard/ops"
        />
        <Checkpoint
          name="AI fallback rate"
          ok="< 5%"
          warn="> 10% → 사용자 인지 가능"
          path="/dashboard/ops"
        />
        <Checkpoint
          name="AI 호출 p95"
          ok="≤ 3,000ms"
          warn="> 3,000ms → Gemini SLA 초과"
          path="/dashboard/ops"
        />
      </div>
    </Section>
  );
}

// ── 3. 시나리오별 평가 ─────────────────────────────────────────────────
function ScenarioMatrix() {
  const rows: Array<[string, "ok" | "warn" | "no", string]> = [
    ["혼자 수동 클릭 테스트", "ok", "Free 1키 충분"],
    ["2명 동시 dev 테스트", "ok", "Free 1키 가능"],
    ["npm test 회귀 (대부분 mock)", "ok", "실 API 거의 미사용"],
    ["30일 시뮬레이션 (15 SOUL × 90턴 = 1,350회)", "warn", "RPD 1,500 한도 근접"],
    ["앱 베타 5명 동시 채팅", "no", "RPM 15 초과 거의 확실"],
    ["실서비스 운영", "no", "절대 불가 — 결제 활성 + 키 풀 필수"],
  ];
  return (
    <Section title="3. 시나리오별 평가 (Free 1키 기준)">
      <div className="overflow-x-auto -mx-1">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-2 py-1">시나리오</th>
              <th className="px-2 py-1">Free 1키 가능?</th>
              <th className="px-2 py-1">근거</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([scenario, ok, why]) => (
              <tr key={scenario} className="border-t border-slate-100">
                <td className="px-2 py-1.5 text-slate-700">{scenario}</td>
                <td className="px-2 py-1.5">
                  <span
                    className={
                      ok === "ok"
                        ? "chip chip-success"
                        : ok === "warn"
                          ? "chip chip-warn"
                          : "chip chip-error"
                    }
                  >
                    {ok === "ok" ? "가능" : ok === "warn" ? "주의" : "불가"}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-muted">{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── 4. 사용자 규모별 의사결정 표 ─────────────────────────────────────
function DecisionTable() {
  const rows: Array<{
    scale: string;
    signal: string;
    action: string;
    change: string;
  }> = [
    {
      scale: "~1,000명",
      signal: "키 풀 3/3 활성, fallback <1%",
      action: "그대로 유지",
      change: "없음",
    },
    {
      scale: "1,000~10,000명",
      signal: "한 키 가끔 cooldown",
      action: "키 6개로 확장",
      change: ".env 콤마 추가",
    },
    {
      scale: "10,000~50,000명",
      signal: "fallback rate 5% 도달",
      action: "Tier 2 자동 승급 ($250 누적 + 30일)",
      change: "없음",
    },
    {
      scale: "50,000명+",
      signal: "Tier 2 도 부족",
      action: "Cloud Quotas Lambda (200% quota 자동 신청)",
      change: "Terraform toggle",
    },
    {
      scale: "중국 사용자 ≥ 10%",
      signal: "China region 트래픽 증가",
      action: "DeepSeek 키 발급",
      change: "GENERATION_REGION_ROUTING=true",
    },
  ];
  return (
    <Section title="4. 사용자 규모별 권장 조치">
      <div className="overflow-x-auto -mx-1">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-2 py-1">규모</th>
              <th className="px-2 py-1">신호</th>
              <th className="px-2 py-1">조치</th>
              <th className="px-2 py-1">코드 변경</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.scale} className="border-t border-slate-100">
                <td className="px-2 py-1.5 font-semibold text-slate-700">{r.scale}</td>
                <td className="px-2 py-1.5 text-slate-600">{r.signal}</td>
                <td className="px-2 py-1.5 text-slate-700">{r.action}</td>
                <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500">{r.change}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── 5. 키 추가 / Tier 승급 절차 ─────────────────────────────────────
function AddKeyProcedure() {
  return (
    <Collapsible title="5. 키 추가 / Tier 승급 단계별 절차 (펼치기)">
      <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700">
        <li>
          <strong>결제 활성</strong> — Google Cloud Console → 결제 (Billing) → 결제 계정 연결.
          신용카드 등록 시 Gemini API 가 자동으로 <strong>Tier 1</strong> 진입 (2,000 RPM / 4M
          TPM / 무제한 RPD). 안 쓰면 0원, pay-as-you-go.
        </li>
        <li>
          <strong>AI Studio 에서 키 발급</strong> — <code>aistudio.google.com/apikey</code> →
          Create API Key → 가급적 <strong>새 프로젝트로 생성</strong> (동일 프로젝트의 키는 quota
          공유). 발급된 키 (<code>AIzaSy…</code>) 즉시 보관 (1Password / AWS Secrets Manager).
        </li>
        <li>
          <strong><code>3. AI/.env</code> 갱신</strong> —
          <pre className="mt-1 mb-1 rounded bg-slate-900/90 text-emerald-100 p-2 text-[11px] font-mono overflow-x-auto">
{`GEMINI_API_KEY=AIzaSy_<기존 키>
GEMINI_API_KEYS=AIzaSy_KEY_A,AIzaSy_KEY_B,AIzaSy_KEY_C`}
          </pre>
          <span className="text-muted">
            GEMINI_API_KEYS (복수) 가 비어 있으면 GEMINI_API_KEY 1개로 fallback —
            backward compatible.
          </span>
        </li>
        <li>
          <strong>서비스 재시작</strong> — <code>cd &quot;3. AI&quot;; npm start</code> (또는
          <code> pm2 restart iconia-ai</code>). 부팅 로그에{" "}
          <code>Gemini key pool initialized: N keys active</code> 가 보이면 성공.
        </li>
        <li>
          <strong>ADMIN 확인</strong> — 본 대시보드 상단 카드 + <Link href="/dashboard/ops" className="text-accent underline">/dashboard/ops</Link> 의 &quot;Gemini 키 풀&quot; 이 <code>N/N 활성</code> 으로 표시되는지 확인.
        </li>
      </ol>
    </Collapsible>
  );
}

// ── 6. 비상 대응 매뉴얼 ──────────────────────────────────────────────
function EmergencyResponse() {
  return (
    <Collapsible title="6. 비상 대응 매뉴얼 (펼치기)" tone="warn">
      <div className="space-y-3 text-xs">
        <div>
          <h4 className="font-semibold text-slate-800">A) 모든 키가 cooldown 에 빠진 경우</h4>
          <p className="text-muted mt-0.5">
            <strong>증상:</strong> /ops 카드 <code>active 0/N</code>, 사용자 응답이 짧고
            추상적인 fallback 카피로 통일.
          </p>
          <ol className="list-decimal list-inside mt-1 space-y-1 text-slate-700">
            <li>즉시 새 키 1~2개 추가 발급 → <code>.env</code> 콤마로 추가 → 재시작</li>
            <li>영구 대책: Tier 승급 신청 (위 5번 절차)</li>
          </ol>
        </div>
        <div>
          <h4 className="font-semibold text-slate-800">B) 키 유출 의심</h4>
          <ol className="list-decimal list-inside mt-1 space-y-1 text-slate-700">
            <li>
              <code>console.cloud.google.com</code> → API &amp; Services → Credentials → 해당
              키 <strong>Delete</strong>
            </li>
            <li>즉시 새 키 발급해 <code>.env</code> 에서 옛 키 교체</li>
            <li>서비스 재시작</li>
            <li>결제 활성 상태라면 Billing → Reports 에서 이상 사용량 확인</li>
          </ol>
        </div>
        <div>
          <h4 className="font-semibold text-slate-800">C) Free tier 한도 급작 초과</h4>
          <p className="text-muted mt-0.5">
            즉시 결제 활성 (5-1번 절차). Tier 1 즉시 진입으로 한도가 약 100배 증가.
          </p>
        </div>
      </div>
    </Collapsible>
  );
}

// ── 공용 UI ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Collapsible({
  title,
  tone = "default",
  children,
}: {
  title: string;
  tone?: "default" | "warn";
  children: ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-200 bg-amber-50/40"
      : "border-slate-200 bg-white/80";
  return (
    <details className={`rounded-2xl border ${cls}`}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
        {title}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

function Cell({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "muted" | "ok" | "warn" | "critical";
}) {
  const valueTone =
    tone === "critical"
      ? "text-rose-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-emerald-700"
          : "text-slate-800";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`text-lg font-bold ${valueTone}`}>{value}</div>
      {hint ? <div className="text-[10px] text-muted mt-0.5">{hint}</div> : null}
    </div>
  );
}

function Note({
  tone,
  children,
}: {
  tone: "warn" | "info";
  children: ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";
  return (
    <div className={`mt-3 rounded-xl border ${cls} px-3 py-2 text-xs`}>{children}</div>
  );
}

function Checkpoint({
  name,
  ok,
  warn,
  path,
}: {
  name: string;
  ok: string;
  warn: string;
  path: string;
}) {
  return (
    <Link
      href={path}
      className="block rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-accent transition"
    >
      <div className="text-xs font-semibold text-slate-800">{name}</div>
      <div className="mt-1 text-[10px] text-emerald-700">정상: {ok}</div>
      <div className="text-[10px] text-amber-700">경고: {warn}</div>
    </Link>
  );
}
