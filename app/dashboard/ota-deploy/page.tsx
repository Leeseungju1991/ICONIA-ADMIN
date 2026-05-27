"use client";

// 2026-05-27 — OTA 펌웨어 업로드·배포 워크플로 (◈6번).
//
// 흐름:
//   1. .bin 파일 선택 → SHA-256 / size 자동 계산 → POST /api/admin/ota/firmwares
//      가 presigned PUT URL + firmware_id 반환.
//   2. presigned URL 로 PUT 업로드 (S3) — 진행률 표시.
//   3. POST /api/admin/ota/firmwares/:id/register 로 메타 확정.
//   4. 디바이스 그룹 선택 + canary % → POST /api/admin/ota/rollouts.
//
// 기존 /dashboard/ota 는 카탈로그 + 진행률 뷰. 이 페이지는 업로드 + 배포 액션.

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { EmptyState, FixtureBadge, LoadingState } from "../_components/CardStates";
import {
  createOtaRolloutAction,
  listDeviceGroupsAction,
  presignFirmwareUploadAction,
  registerFirmwareUploadAction,
} from "@/lib/actions/otaDeploy";
import type { OtaDeviceGroup } from "@/types/admin-api";

type UploadStage = "idle" | "hashing" | "presigning" | "uploading" | "registering" | "done";

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  // SubtleCrypto — 모든 modern 브라우저 + Next 14 클라이언트.
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function OtaDeployPage() {
  const [groups, setGroups] = useState<OtaDeviceGroup[]>([]);
  const [source, setSource] = useState<"server" | "fixture" | null>(null);
  const [loadingGroups, startGroups] = useTransition();

  // Upload state.
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [channel, setChannel] = useState<"stable" | "beta" | "canary" | "dev">("canary");
  const [notes, setNotes] = useState("");
  const [stage, setStage] = useState<UploadStage>("idle");
  const [stageDetail, setStageDetail] = useState<string>("");
  const [firmwareId, setFirmwareId] = useState<string | null>(null);
  const [sha, setSha] = useState<string | null>(null);

  // Rollout state.
  const [pickedGroups, setPickedGroups] = useState<string[]>([]);
  const [canaryPct, setCanaryPct] = useState(5);
  const [rolloutMsg, setRolloutMsg] = useState<string | null>(null);
  const [rolloutPending, startRollout] = useTransition();

  useEffect(() => {
    startGroups(async () => {
      const r = await listDeviceGroupsAction();
      if (r.ok) {
        setGroups(r.data.items);
        setSource(r.source);
      }
    });
  }, []);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setStage("hashing");
    setStageDetail(`SHA-256 계산 중 — ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    const buf = await file.arrayBuffer();
    const hex = await sha256Hex(buf);
    setSha(hex);

    setStage("presigning");
    setStageDetail("Server presigned URL 요청 중...");
    const pres = await presignFirmwareUploadAction({
      filename: file.name,
      size_bytes: file.size,
      sha256: hex,
      version: version.trim(),
      channel,
      notes: notes.trim() || undefined,
    });
    if (!pres.ok) {
      setStage("idle");
      setStageDetail(`presign 실패: ${pres.message}`);
      return;
    }
    setFirmwareId(pres.data.firmware_id);

    setStage("uploading");
    setStageDetail("S3 에 업로드 중...");
    try {
      const r = await fetch(pres.data.upload_url, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: buf,
      });
      if (!r.ok) {
        setStage("idle");
        setStageDetail(`S3 업로드 실패 (HTTP ${r.status})`);
        return;
      }
    } catch (err) {
      setStage("idle");
      setStageDetail(`업로드 네트워크 오류: ${(err as Error).message}`);
      return;
    }

    setStage("registering");
    setStageDetail("서버에 등록 중...");
    const reg = await registerFirmwareUploadAction({ firmwareId: pres.data.firmware_id });
    if (!reg.ok) {
      setStage("idle");
      setStageDetail(`등록 실패: ${reg.message}`);
      return;
    }
    setStage("done");
    setStageDetail(`등록 완료 — firmware_id=${pres.data.firmware_id}`);
  }

  async function handleRollout() {
    if (!firmwareId) {
      setRolloutMsg("업로드를 먼저 완료하세요.");
      return;
    }
    if (pickedGroups.length === 0) {
      setRolloutMsg("디바이스 그룹을 최소 1개 선택하세요.");
      return;
    }
    const phrase = window.prompt(
      `OTA 배포 시작\n\n버전: ${version} → 그룹 ${pickedGroups.length}개 · canary ${canaryPct}%\n\n실행하려면 "EXECUTE" 입력:`,
    );
    if (phrase !== "EXECUTE") {
      setRolloutMsg("취소됨.");
      return;
    }
    startRollout(async () => {
      const r = await createOtaRolloutAction({
        firmware_id: firmwareId,
        group_ids: pickedGroups,
        canary_percent: canaryPct,
      });
      if (!r.ok) {
        setRolloutMsg(`배포 실패: ${r.message}`);
        return;
      }
      setRolloutMsg(`배포 시작 — rollout_id=${r.data.rollout_id} (${r.data.state})`);
    });
  }

  const stageBadge = useMemo(() => {
    switch (stage) {
      case "idle":
        return null;
      case "done":
        return <span className="chip chip-success">완료</span>;
      default:
        return <span className="chip chip-info">{stage}</span>;
    }
  }, [stage]);

  return (
    <div className="space-y-6">
      <PanelCard
        title="① 펌웨어 업로드"
        description="POST /api/admin/ota/firmwares → presigned PUT 으로 S3 업로드 → register 로 메타 확정."
      >
        <form onSubmit={handleUpload} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-600 space-y-1">
              <span>버전</span>
              <input
                className="input"
                placeholder="예: 1.4.4"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                required
              />
            </label>
            <label className="text-xs text-slate-600 space-y-1">
              <span>채널</span>
              <select
                className="select"
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
              >
                <option value="canary">canary</option>
                <option value="beta">beta</option>
                <option value="stable">stable</option>
                <option value="dev">dev</option>
              </select>
            </label>
          </div>
          <label className="text-xs text-slate-600 space-y-1 block">
            <span>릴리즈 노트</span>
            <textarea
              className="input"
              rows={2}
              placeholder="변경점 요약..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600 space-y-1 block">
            <span>펌웨어 파일 (.bin)</span>
            <input
              type="file"
              accept=".bin,.img"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
          </label>
          {file ? (
            <div className="text-[11px] text-slate-500 font-mono">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              {sha ? ` · sha256=${sha.slice(0, 16)}…` : ""}
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!file || stage !== "idle" || version.length < 3}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              업로드 시작
            </button>
            {stageBadge}
            {stageDetail ? (
              <span className="text-xs text-slate-600">{stageDetail}</span>
            ) : null}
          </div>
        </form>
      </PanelCard>

      <PanelCard
        title="② 디바이스 그룹 선택 + 배포"
        description="POST /api/admin/ota/rollouts — canary % 로 단계 진행. 5% → 25% → 100% 자동 promotion 은 서버 정책."
        actions={source === "fixture" ? <FixtureBadge /> : null}
      >
        {loadingGroups ? (
          <LoadingState />
        ) : groups.length === 0 ? (
          <EmptyState title="디바이스 그룹 없음" hint="/api/admin/ota/device-groups 응답 비어있음." />
        ) : (
          <>
            <ul className="space-y-1 mb-4">
              {groups.map((g) => {
                const checked = pickedGroups.includes(g.id);
                return (
                  <li key={g.id}>
                    <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setPickedGroups((cur) =>
                            checked ? cur.filter((x) => x !== g.id) : [...cur, g.id],
                          )
                        }
                      />
                      <span className="font-medium text-slate-800">{g.label}</span>
                      <span className="ml-auto text-xs text-slate-500 font-mono">
                        {g.device_count.toLocaleString()}대
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs text-slate-600">canary %</label>
              <input
                type="range"
                min={1}
                max={100}
                value={canaryPct}
                onChange={(e) => setCanaryPct(Number(e.target.value))}
                className="flex-1"
              />
              <span className="font-mono text-sm w-12 text-right">{canaryPct}%</span>
            </div>
            <button
              type="button"
              onClick={handleRollout}
              disabled={!firmwareId || pickedGroups.length === 0 || rolloutPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {rolloutPending ? "배포 시작 중..." : "배포 시작"}
            </button>
            {rolloutMsg ? (
              <p className="mt-2 text-xs text-slate-600">{rolloutMsg}</p>
            ) : null}
          </>
        )}
      </PanelCard>
    </div>
  );
}
