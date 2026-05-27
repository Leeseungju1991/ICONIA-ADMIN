"use client";

// 약관 / 법률 관리 — (주)숨코리아 출시 정비.
//
// 표면 구성:
//   1) 활성 버전 카드 (terms/privacy/marketing/third_party)
//   2) 약관 본문 미리보기 (다국어 — ko 본문 + en placeholder)
//   3) 신규 버전 발행 폼 (superadmin 만 활성)
//   4) 동의 통계 KPI (약관 버전별, 마케팅 동의율)
//   5) 사업자 정보 (footer 표시 중복 — About 영역)
//
// Server endpoint 우선 호출 후 미구현 시 placeholder + DEMO 배너.

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import { MockDataBanner } from "../_components/MockDataBanner";
import {
  getActiveTermsAction,
  listTermsAction,
  publishTermsAction,
  getConsentStatsAction,
  getBusinessInfoAction,
} from "@/lib/actions/legal";
import type {
  ActiveTermsVersions,
  ConsentStats,
  TermsKind,
  TermsVersionRow,
} from "@/lib/adminApi";
import type { BusinessInfo } from "@/lib/companyInfo";

const KIND_LABEL: Record<TermsKind, string> = {
  terms: "서비스 이용약관",
  privacy: "개인정보 처리방침",
  marketing: "마케팅 정보 수신",
  third_party: "제3자 제공 (Gemini)",
};

const KIND_ORDER: TermsKind[] = ["terms", "privacy", "marketing", "third_party"];

export default function LegalPage() {
  const [active, setActive] = useState<ActiveTermsVersions | null>(null);
  const [termsRows, setTermsRows] = useState<TermsVersionRow[]>([]);
  const [termsPlaceholder, setTermsPlaceholder] = useState<boolean>(false);
  const [stats, setStats] = useState<ConsentStats | null>(null);
  const [statsPlaceholder, setStatsPlaceholder] = useState<boolean>(false);
  const [biz, setBiz] = useState<BusinessInfo | null>(null);
  const [previewKind, setPreviewKind] = useState<TermsKind>("terms");
  const [previewLocale, setPreviewLocale] = useState<"ko" | "en">("ko");
  const [loading, startLoad] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function reload() {
    startLoad(async () => {
      const [a, t, s, b] = await Promise.all([
        getActiveTermsAction(),
        listTermsAction(),
        getConsentStatsAction({ days: 30 }),
        getBusinessInfoAction(),
      ]);
      if (a.ok) setActive(a.data);
      if (t.ok) {
        setTermsRows(t.data.items);
        setTermsPlaceholder(t.data.placeholder);
      }
      if (s.ok) {
        setStats(s.data.stats);
        setStatsPlaceholder(s.data.placeholder);
      }
      if (b.ok) setBiz(b.data);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  const activeRow = termsRows.find((r) => r.kind === previewKind && r.is_active) ?? null;
  const previewBody =
    previewLocale === "ko"
      ? (activeRow?.body_ko ?? "(본문 없음)")
      : (activeRow?.body_en ?? "(영문 본문 미작성 — 출시 전 번역 예정)");

  return (
    <div className="space-y-6">
      {(termsPlaceholder || statsPlaceholder) && (
        <MockDataBanner
          reason={`약관/동의 통계 endpoint 미구현 — placeholder 본문/수치로 표시 중. ${termsPlaceholder ? "약관" : ""}${termsPlaceholder && statsPlaceholder ? " · " : ""}${statsPlaceholder ? "동의 통계" : ""}`}
          endpoint="/api/v1/admin/legal/terms · /api/v1/admin/legal/consent-stats"
        />
      )}

      <PanelCard
        title="활성 약관 버전"
        description="신규 가입자가 동의해야 하는 운영 정본 버전. 사용자도 동일 값을 본다."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs disabled:opacity-60"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {KIND_ORDER.map((k) => {
            const row = termsRows.find((r) => r.kind === k && r.is_active);
            const version =
              row?.version ??
              (k === "terms"
                ? active?.terms_version
                : k === "privacy"
                ? active?.privacy_version
                : k === "marketing"
                ? active?.marketing_version
                : active?.third_party_version) ??
              "—";
            return (
              <div
                key={k}
                className="rounded-2xl border border-white/60 bg-white/55 p-3"
              >
                <div className="text-[11px] text-muted">{KIND_LABEL[k]}</div>
                <div className="text-lg font-bold text-slate-900 mt-1">
                  {String(version)}
                </div>
                <div className="text-[11px] text-muted mt-1">
                  {row?.effective_from
                    ? `발효 ${row.effective_from.slice(0, 10)}`
                    : "발효일 미지정"}
                </div>
              </div>
            );
          })}
        </div>
      </PanelCard>

      <PanelCard
        title="약관 본문 미리보기"
        description="운영자가 사용자에게 노출되는 본문을 그대로 확인합니다. 다국어 ko/en 토글."
        actions={
          <div className="flex gap-2">
            <select
              className="rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-xs"
              value={previewKind}
              onChange={(e) => setPreviewKind(e.target.value as TermsKind)}
            >
              {KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <div className="flex gap-1 p-1 rounded-full bg-white/60 border border-white/60">
              {(["ko", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setPreviewLocale(l)}
                  className={
                    "rounded-full px-3 py-1 text-xs font-medium transition " +
                    (previewLocale === l
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-white/70")
                  }
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="rounded-2xl border border-white/60 bg-white/55 p-4 max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-xs text-slate-800 font-sans leading-relaxed">
            {previewBody}
          </pre>
        </div>
        {activeRow ? (
          <div className="mt-2 text-[11px] text-muted">
            버전 <span className="font-mono">{activeRow.version}</span>
            {activeRow.change_note ? ` · ${activeRow.change_note}` : ""}
            {activeRow.body_hash ? ` · hash ${activeRow.body_hash.slice(0, 12)}…` : ""}
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-muted">활성 버전이 없습니다.</div>
        )}
      </PanelCard>

      <PanelCard
        title="이전 버전 / 모든 발행 이력"
        description="활성·이전·staging 모든 버전. 운영자가 회귀 비교용으로 조회."
      >
        {termsRows.length === 0 ? (
          <div className="text-sm text-muted">기록이 없습니다.</div>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {termsRows.map((r) => (
              <li
                key={`${r.kind}-${r.version}`}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="chip chip-muted">{KIND_LABEL[r.kind]}</span>
                  <span className="font-mono">{r.version}</span>
                  {r.is_active ? (
                    <span className="chip chip-success">활성</span>
                  ) : null}
                </div>
                <div className="text-[10px] text-muted truncate">
                  {r.effective_from.slice(0, 10)}
                  {r.change_note ? ` · ${r.change_note}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <NewVersionPanel onPublished={(msg) => { setToast(msg); reload(); }} />

      <PanelCard
        title="동의 통계 (최근 30일)"
        description="약관 버전별 동의/거부 카운트 + 마케팅 동의율."
      >
        {stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="총 동의 이벤트"
              value={stats.total_consent_events.toLocaleString()}
              delta="30일 누적"
              deltaTone="flat"
              hint="register + reconsent"
              accent="blue"
            />
            <StatCard
              label="마케팅 동의율"
              value={`${(stats.marketing_opt_in_rate * 100).toFixed(1)}%`}
              delta={stats.marketing_opt_in_rate > 0.5 ? "양호" : "낮음"}
              deltaTone={stats.marketing_opt_in_rate > 0.5 ? "up" : "down"}
              hint="opt-in / total"
              accent="pink"
            />
            <StatCard
              label="제3자 제공 동의"
              value={`${getKindGrantedRate(stats, "third_party")}%`}
              delta="Gemini 이전 동의"
              deltaTone="flat"
              hint="필수 — register 차단"
              accent="orange"
            />
            <StatCard
              label="약관/개인정보 동의율"
              value={`${getKindGrantedRate(stats, "terms")}%`}
              delta="terms+privacy"
              deltaTone="up"
              hint="모든 가입자 100% 도달이 정상"
              accent="teal"
            />
          </div>
        ) : (
          <div className="text-sm text-muted">불러오는 중</div>
        )}
      </PanelCard>

      <PanelCard
        title="회사 정보 (사업자)"
        description="운영자가 보는 (주)숨코리아 사업자 표시. 사용자 App About 화면도 동일 값."
      >
        {biz ? <BusinessInfoBlock info={biz} /> : <div className="text-sm text-muted">불러오는 중</div>}
      </PanelCard>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card">
          {toast}
          <button
            className="ml-3 underline opacity-80"
            onClick={() => setToast(null)}
            type="button"
          >
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}

function getKindGrantedRate(stats: ConsentStats, kind: TermsKind): string {
  const rows = stats.by_kind[kind] ?? [];
  const granted = rows.reduce((s, r) => s + r.granted, 0);
  const revoked = rows.reduce((s, r) => s + r.revoked, 0);
  const total = granted + revoked;
  if (total === 0) return "—";
  return ((granted / total) * 100).toFixed(1);
}

function NewVersionPanel({ onPublished }: { onPublished: (msg: string) => void }) {
  const [kind, setKind] = useState<TermsKind>("terms");
  const [version, setVersion] = useState("v1.1");
  const [bodyKo, setBodyKo] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [activate, setActivate] = useState(false);
  const [busy, startBusy] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startBusy(async () => {
      const r = await publishTermsAction({
        kind,
        version,
        body_ko: bodyKo,
        change_note: changeNote,
        activate,
      });
      if (!r.ok) {
        onPublished(`발행 실패: ${r.message}`);
        return;
      }
      onPublished(
        `발행됨: ${KIND_LABEL[r.data.kind]} ${r.data.version}${activate ? " (활성)" : " (staging)"}`,
      );
      setBodyKo("");
      setChangeNote("");
    });
  }

  return (
    <PanelCard
      title="신규 버전 발행 (superadmin)"
      description="활성화 시 신규 가입자가 즉시 본 버전에 동의해야 합니다. 기존 사용자는 reconsent 안내."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted">약관 종류</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as TermsKind)}
              className="rounded-xl border-2 border-slate-300 bg-white px-3 py-2"
            >
              {KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted">버전</span>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v1.1"
              className="rounded-xl border-2 border-slate-300 bg-white px-3 py-2 font-mono"
              required
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">한국어 본문 (20자 이상)</span>
          <textarea
            value={bodyKo}
            onChange={(e) => setBodyKo(e.target.value)}
            rows={6}
            className="rounded-xl border-2 border-slate-300 bg-white px-3 py-2"
            required
            minLength={20}
            placeholder="# 서비스 이용약관 ..."
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">변경 사유 (5자 이상)</span>
          <input
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            className="rounded-xl border-2 border-slate-300 bg-white px-3 py-2"
            required
            minLength={5}
            placeholder="개인정보보호위원회 시정 권고 반영"
          />
        </label>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={activate}
              onChange={(e) => setActivate(e.target.checked)}
            />
            <span>발행 즉시 활성화 (체크 안 하면 staging)</span>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-accent px-4 py-2 text-sm text-white shadow-card disabled:opacity-60"
          >
            {busy ? "발행 중..." : "발행"}
          </button>
        </div>
      </form>
    </PanelCard>
  );
}

function BusinessInfoBlock({ info }: { info: BusinessInfo }) {
  const rows: Array<[string, string]> = [
    ["상호 (KO)", info.company_name_ko],
    ["상호 (EN)", info.company_name_en],
    ["대표자", info.ceo],
    ["사업자등록번호", info.business_registration_no],
    ["통신판매업 신고", info.ecommerce_registration_no],
    ["본사 주소 (KO)", info.address_ko],
    ["본사 주소 (EN)", info.address_en],
    ["대표 전화", info.phone],
    ["고객지원 이메일", info.support_email],
    ["개인정보보호책임자", info.privacy_officer],
    ["개인정보보호 이메일", info.privacy_officer_email],
  ];
  return (
    <div className="space-y-2">
      {info.placeholder ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠ placeholder — Server `/api/v1/legal/business-info` 미구현. 사업자등록 완료 후 실 값으로 교체.
        </div>
      ) : null}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1">
            <dt className="text-muted">{k}</dt>
            <dd className="text-slate-800 text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
