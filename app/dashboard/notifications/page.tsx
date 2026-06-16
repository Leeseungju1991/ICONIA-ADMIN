"use client";

// 2026-05-27 — 공지/알람 작성 — 전체 또는 세그먼트 푸시 + 인앱 배너 (◈6번).
// POST /api/admin/notifications  (현재 서버 라우트 미구현 — 호출만 작성, fallback 안내).

import { useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DangerConfirmDialog } from "../_components/DangerConfirmDialog";
import { broadcastNotificationAction } from "@/lib/actions/notificationsBroadcast";
import type {
  NotificationAudienceKind,
  NotificationChannel,
} from "@/types/admin-api";

const CHANNELS: Array<{ key: NotificationChannel; label: string; hint: string }> = [
  { key: "push", label: "앱 푸시", hint: "RN Expo Push — 즉시" },
  { key: "in_app_banner", label: "인앱 배너", hint: "다음 앱 진입 시 표시" },
];

const AUDIENCE_KINDS: Array<{ key: NotificationAudienceKind; label: string; hint: string }> = [
  { key: "all", label: "전체 사용자", hint: "모든 활성 사용자에게 전송" },
  { key: "user_segment", label: "특정 사용자군", hint: "user_id 목록 (콤마/줄바꿈 구분)" },
  { key: "device_group", label: "특정 디바이스군", hint: "device_id 목록 (콤마/줄바꿈 구분)" },
];

export default function NotificationsBroadcastPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channels, setChannels] = useState<NotificationChannel[]>(["push"]);
  const [audienceKind, setAudienceKind] = useState<NotificationAudienceKind>("all");
  const [audienceText, setAudienceText] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  // 발송 결과 토스트 — devices/users 페이지 컨벤션(fixed bottom-right).
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  // V1.0 라운드 — window.confirm → DangerConfirmDialog 정합.
  // pendingBroadcast 가 null 아니면 모달 표시. 사용자 동의 시 doBroadcast 호출.
  const [pendingBroadcast, setPendingBroadcast] = useState<{
    audience_ids: string[];
  } | null>(null);

  function toggleChannel(c: NotificationChannel) {
    setChannels((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const audience_ids =
      audienceKind === "all"
        ? []
        : audienceText
            .split(/[,\n\s]+/)
            .map((s) => s.trim())
            .filter(Boolean);
    if (audienceKind !== "all" && audience_ids.length === 0) {
      setResult(`대상 ${audienceKind === "user_segment" ? "사용자" : "디바이스"} ID 를 1개 이상 입력하세요.`);
      return;
    }
    // 강력액션 정합 — DangerConfirmDialog 트리거. 실제 발송은 doBroadcast.
    setPendingBroadcast({ audience_ids });
  }

  function doBroadcast() {
    const pending = pendingBroadcast;
    if (!pending) return;
    setPendingBroadcast(null);
    startSubmit(async () => {
      const r = await broadcastNotificationAction({
        title,
        body,
        channels,
        audience_kind: audienceKind,
        audience_ids: pending.audience_ids,
        scheduled_at: scheduledAt || null,
      });
      if (!r.ok) {
        if (r.unreachable) {
          const msg =
            "서버 라우트 미구현 — POST /api/v1/admin/notifications 가 아직 배포되지 않았습니다. 작성한 본문은 새로고침 시 사라집니다.";
          setResult(msg);
          setToast(msg);
          return;
        }
        const msg = `발송 실패: ${r.message}`;
        setResult(msg);
        setToast(msg);
        return;
      }
      const msg = `발송 ${r.data.status} — id=${r.data.id}`;
      setResult(msg);
      setToast(msg);
      // 폼 리셋은 사용자가 결과 확인 후 직접.
    });
  }

  const previewBadge =
    audienceKind === "all"
      ? "전체"
      : audienceKind === "user_segment"
        ? "사용자군"
        : "디바이스군";

  return (
    <div className="space-y-6">
      <PanelCard
        title="공지/알람 작성 + 발송"
        description="앱 푸시·인앱 배너로 공지·알림을 작성해 발송합니다."
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-3">
            <label className="text-xs text-slate-600 space-y-1 block">
              <span>제목 (2자 이상)</span>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 시스템 점검 안내"
                required
                minLength={2}
              />
            </label>
            <label className="text-xs text-slate-600 space-y-1 block">
              <span>본문 (5자 이상)</span>
              <textarea
                className="input"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="공지 본문을 입력하세요."
                required
                minLength={5}
              />
            </label>

            <fieldset className="rounded-xl border border-slate-200 p-3">
              <legend className="text-xs font-semibold text-slate-700 px-1">발송 채널</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CHANNELS.map((c) => (
                  <label
                    key={c.key}
                    className={[
                      "flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition",
                      channels.includes(c.key)
                        ? "border-accent bg-accent/5"
                        : "border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={channels.includes(c.key)}
                      onChange={() => toggleChannel(c.key)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-800">{c.label}</div>
                      <div className="text-[11px] text-slate-500">{c.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="rounded-xl border border-slate-200 p-3">
              <legend className="text-xs font-semibold text-slate-700 px-1">발송 대상</legend>
              <div className="space-y-2">
                {AUDIENCE_KINDS.map((a) => (
                  <label
                    key={a.key}
                    className={[
                      "flex items-start gap-2 rounded-lg border px-3 py-2 cursor-pointer transition",
                      audienceKind === a.key
                        ? "border-accent bg-accent/5"
                        : "border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="audience"
                      checked={audienceKind === a.key}
                      onChange={() => setAudienceKind(a.key)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">{a.label}</div>
                      <div className="text-[11px] text-slate-500">{a.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
              {audienceKind !== "all" ? (
                <textarea
                  className="input mt-2 font-mono text-xs"
                  rows={3}
                  placeholder={
                    audienceKind === "user_segment"
                      ? "usr_001, usr_002\nusr_003"
                      : "device_001, device_002"
                  }
                  value={audienceText}
                  onChange={(e) => setAudienceText(e.target.value)}
                />
              ) : null}
            </fieldset>

            <label className="text-xs text-slate-600 space-y-1 block">
              <span>예약 발송 (선택, 비우면 즉시)</span>
              <input
                type="datetime-local"
                className="input"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting || channels.length === 0}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "발송 중..." : "발송"}
              </button>
              {result ? <span className="text-xs text-slate-600">{result}</span> : null}
            </div>
          </div>

          {/* 미리보기 */}
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700 mb-2">미리보기 — 인앱 배너</div>
              <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 shadow-card">
                <div className="text-[11px] text-slate-500">ICONIA</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {title || "(제목)"}
                </div>
                <div className="text-xs text-slate-600 mt-1 line-clamp-3">
                  {body || "(본문)"}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-700 mb-2">미리보기 — 앱 푸시</div>
              <div className="rounded-2xl bg-slate-900 text-white px-3 py-2.5 shadow-card">
                <div className="text-[10px] opacity-70">ICONIA · 지금</div>
                <div className="text-sm font-semibold">{title || "(제목)"}</div>
                <div className="text-xs opacity-85 line-clamp-2">{body || "(본문)"}</div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <div className="font-semibold mb-1 text-slate-700">발송 요약</div>
              <ul className="space-y-1">
                <li>채널: {channels.length === 0 ? "—" : channels.join(", ")}</li>
                <li>대상: {previewBadge}</li>
                {scheduledAt ? <li>예약: {scheduledAt}</li> : <li>예약: 즉시</li>}
              </ul>
            </div>
          </div>
        </form>
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

      <DangerConfirmDialog
        open={pendingBroadcast !== null}
        title={audienceKind === "all" ? "전체 사용자 발송" : "푸시/배너 발송"}
        description={
          audienceKind === "all"
            ? "전체 활성 사용자에게 발송합니다. 이 결정은 되돌릴 수 없습니다."
            : `${pendingBroadcast?.audience_ids.length ?? 0}개 대상에 발송합니다.`
        }
        detail={
          <div className="space-y-1">
            <div>제목: <b>{title || "(제목 없음)"}</b></div>
            <div>채널: {channels.length === 0 ? "—" : channels.join(", ")}</div>
            {scheduledAt ? <div>예약: {scheduledAt}</div> : <div>발송 시점: 즉시</div>}
          </div>
        }
        confirmLabel="발송"
        busy={submitting}
        onConfirm={doBroadcast}
        onCancel={() => setPendingBroadcast(null)}
      />
    </div>
  );
}
