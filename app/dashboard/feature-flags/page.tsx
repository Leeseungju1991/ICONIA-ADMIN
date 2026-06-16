"use client";

// 2026-06-16 — 사용자별 Feature Flag 토글 (Wave 4 — 그로스/공유).
// GET   /api/v1/admin/users/:userId/feature-flags -> { flags: [{flag_key, enabled}] }
// PATCH /api/v1/admin/users/:userId/feature-flags  body={flag_key, enabled}
// 특정 사용자의 빌드타임 flag override 를 조회하고 개별 flag 를 토글한다.
// 알려진 flag_key(feed/doll/mypage/commerce/rag) 는 항상 노출되며, 서버가 추가로
// 반환한 미지의 flag 도 함께 표시한다. override 미설정 flag 는 enabled=false 로 간주.

import { useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import { EmptyState, ErrorState, LoadingState } from "../_components/CardStates";
import {
  listUserFeatureFlagsAction,
  setUserFeatureFlagAction,
} from "@/lib/actions/featureFlags";
import {
  KNOWN_FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
  type UserFeatureFlagRow,
} from "@/types/admin-api";

const FLAG_LABEL: Record<string, string> = {
  feed: "피드 (feed)",
  doll: "인형 (doll)",
  mypage: "마이페이지 (mypage)",
  commerce: "커머스 (commerce)",
  rag: "RAG 대화 (rag)",
};

function flagLabel(key: FeatureFlagKey): string {
  return FLAG_LABEL[key] ?? key;
}

/** 알려진 flag 키 + 서버가 반환한 키를 합쳐 정렬된 목록으로 머지. */
function mergeFlags(rows: UserFeatureFlagRow[]): UserFeatureFlagRow[] {
  const map = new Map<string, boolean>();
  for (const key of KNOWN_FEATURE_FLAG_KEYS) map.set(key, false);
  for (const r of rows) map.set(r.flag_key, r.enabled);
  return Array.from(map.entries()).map(([flag_key, enabled]) => ({
    flag_key,
    enabled,
  }));
}

export default function FeatureFlagsPage() {
  const [userId, setUserId] = useState("");
  const [flags, setFlags] = useState<UserFeatureFlagRow[] | null>(null);
  const [error, setError] = useState<{ message: string; unreachable: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [acting, startAct] = useTransition();

  function reload() {
    const uid = userId.trim();
    if (!uid) {
      setToast("조회할 사용자 ID 를 입력하세요.");
      return;
    }
    startLoad(async () => {
      const r = await listUserFeatureFlagsAction({ userId: uid });
      if (!r.ok) {
        setError({ message: r.message, unreachable: !!r.unreachable });
        setFlags(null);
        return;
      }
      setError(null);
      setFlags(mergeFlags(r.data.flags));
    });
  }

  const list: UserFeatureFlagRow[] = useMemo(() => flags ?? [], [flags]);
  const enabledCount = useMemo(
    () => list.filter((f) => f.enabled).length,
    [list],
  );

  function handleToggle(row: UserFeatureFlagRow) {
    const uid = userId.trim();
    if (!uid) return;
    const next = !row.enabled;
    setPendingKey(row.flag_key);
    startAct(async () => {
      const res = await setUserFeatureFlagAction({
        userId: uid,
        flagKey: row.flag_key,
        enabled: next,
      });
      setPendingKey(null);
      if (!res.ok) {
        setToast(`토글 실패: ${res.message}`);
        return;
      }
      // 서버 응답(flag_key, enabled) 으로 해당 행만 갱신 (낙관적 대신 정본 반영).
      setFlags((cur) =>
        (cur ?? []).map((f) =>
          f.flag_key === res.data.flag_key ? { ...f, enabled: res.data.enabled } : f,
        ),
      );
      setToast(
        `${flagLabel(res.data.flag_key)} — ${res.data.enabled ? "켜짐" : "꺼짐"}`,
      );
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="플래그 수"
          value={flags ? list.length.toLocaleString() : "—"}
          hint={flags ? "알려진 + override" : "사용자 ID 조회 전"}
          accent="blue"
        />
        <StatCard
          label="활성 플래그"
          value={flags ? enabledCount.toLocaleString() : "—"}
          hint={flags ? "enabled=true 개수" : "조회 전"}
          accent="teal"
        />
        <StatCard
          label="조회 대상"
          value={userId.trim() ? "지정됨" : "미지정"}
          hint="특정 사용자 UUID"
          accent="pink"
        />
      </section>

      <PanelCard
        title="사용자별 Feature Flag"
        description="특정 사용자의 빌드타임 플래그 override 를 조회하고 개별 플래그를 켜고 끕니다. 변경은 즉시 서버에 반영됩니다."
      >
        <form
          className="flex flex-wrap items-end gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            reload();
          }}
        >
          <label className="flex flex-col gap-1 min-w-[260px] flex-1">
            <span className="text-xs text-slate-500">사용자 ID (UUID)</span>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="플래그를 조회할 사용자 ID"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent text-white px-4 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "조회 중..." : "조회"}
          </button>
        </form>

        {error ? (
          <ErrorState message={error.message} unreachable={error.unreachable} onRetry={reload} />
        ) : flags === null ? (
          <EmptyState
            title="사용자 ID 를 입력하고 조회하세요"
            hint="해당 사용자의 기능 플래그 목록이 표시됩니다."
          />
        ) : loading ? (
          <LoadingState />
        ) : list.length === 0 ? (
          <EmptyState title="플래그 없음" hint="표시할 기능 플래그가 없습니다." />
        ) : (
          <ul className="space-y-2">
            {list.map((f) => (
              <FlagRow
                key={f.flag_key}
                row={f}
                onToggle={() => handleToggle(f)}
                disabled={acting}
                pending={acting && pendingKey === f.flag_key}
              />
            ))}
          </ul>
        )}
      </PanelCard>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card max-w-md">
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

function FlagRow({
  row,
  onToggle,
  disabled,
  pending,
}: {
  row: UserFeatureFlagRow;
  onToggle: () => void;
  disabled: boolean;
  pending: boolean;
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-900 truncate">
          {flagLabel(row.flag_key)}
        </div>
        <div className="text-[11px] text-slate-500">
          <span className="font-mono">{row.flag_key}</span>
          {" · "}
          <span className={row.enabled ? "text-emerald-600" : "text-slate-400"}>
            {row.enabled ? "활성" : "비활성"}
          </span>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={row.enabled}
        aria-label={`${flagLabel(row.flag_key)} ${row.enabled ? "끄기" : "켜기"}`}
        onClick={onToggle}
        disabled={disabled}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60",
          row.enabled ? "bg-accent" : "bg-slate-300",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            row.enabled ? "translate-x-5" : "translate-x-0.5",
            pending ? "animate-pulse" : "",
          ].join(" ")}
        />
      </button>
    </li>
  );
}
