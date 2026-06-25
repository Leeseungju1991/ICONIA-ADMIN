"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import {
  listIpAllowlistAction,
  addIpAllowlistAction,
  deleteIpAllowlistAction,
} from "@/lib/actions/ipAllowlist";
import type { IpAllowlistEntry } from "@/lib/adminApi";

// [PDF #11] 운영자 IP 허용목록 — Server `/api/v1/admin/security/ip-allowlist` 실 연동.
// 2026-06-25 — stub(ERR_NOT_IMPLEMENTED) 제거, 실 actions 로 교체.
//
// 정책: 등록된 IP 만 운영자 콘솔 로그인 가능. 추가·삭제는 superadmin 전용.
// 비상시(VPN 다운) break-glass 흐름은 out-of-band 인증 후속 라운드 예정.

export default function IpAllowlistPage() {
  const [items, setItems] = useState<IpAllowlistEntry[]>([]);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [loading, startLoad] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mutating, startMutate] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listIpAllowlistAction();
      if (!r.ok) {
        setError({ code: r.code, message: r.message });
        setItems([]);
      } else {
        setError(null);
        setItems(r.data.items);
      }
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDelete(entry: IpAllowlistEntry) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`[${entry.label || entry.cidr}] (${entry.cidr}) 를 허용목록에서 삭제하시겠습니까?`)
    )
      return;
    setDeletingId(entry.id);
    startMutate(async () => {
      const r = await deleteIpAllowlistAction({ id: entry.id });
      setDeletingId(null);
      if (!r.ok) {
        setToast(`삭제 실패: ${r.message}`);
        return;
      }
      setToast(`삭제 완료: ${entry.cidr}`);
      reload();
    });
  }

  const columns: Column<IpAllowlistEntry & { id: string }>[] = [
    {
      key: "cidr",
      header: "CIDR / IP",
      render: (r) => <span className="font-mono text-sm">{r.cidr}</span>,
    },
    { key: "label", header: "라벨", render: (r) => r.label || "—" },
    {
      key: "added_by",
      header: "등록자",
      render: (r) => <span className="font-mono text-xs">{r.added_by}</span>,
    },
    {
      key: "added_at",
      header: "등록일",
      render: (r) => <span className="text-xs text-muted">{r.added_at.slice(0, 10)}</span>,
    },
    {
      key: "last_seen_at",
      header: "최근 로그인",
      render: (r) => (
        <span className="text-xs text-muted">{r.last_seen_at ? r.last_seen_at.slice(0, 10) : "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button
          type="button"
          onClick={() => handleDelete(r)}
          disabled={mutating || deletingId === r.id}
          className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deletingId === r.id ? "삭제 중..." : "삭제"}
        </button>
      ),
    },
  ];

  // 서버 endpoint 미구현 시 graceful 안내 (SERVER agent 도입 대기)
  const notImplemented =
    error?.code === "ERR_NOT_IMPLEMENTED" || error?.code === "ERR_NOT_FOUND";

  return (
    <div className="space-y-6">
      <PanelCard
        title="운영자 IP 허용목록"
        description="등록된 IP 에서만 운영자 콘솔 로그인이 가능합니다. 추가·삭제는 최고관리자 전용입니다."
        actions={
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={loading || notImplemented}
            className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
          >
            CIDR 추가
          </button>
        }
      >
        {notImplemented ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div className="font-medium">Server endpoint 준비 중</div>
            <div className="mt-1 text-xs text-muted">
              SERVER agent 가 <code className="mx-1 rounded bg-slate-100 px-1 font-mono">/api/v1/admin/security/ip-allowlist</code>{" "}
              (GET/POST/DELETE) 를 구현하면 자동 활성됩니다.
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-3 text-xs text-rose-700">
            {error.message}
          </div>
        ) : loading ? (
          <div className="py-8 text-center text-xs text-muted">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">등록된 IP 가 없습니다.</div>
        ) : (
          <DataTable
            columns={columns}
            rows={items.map((i) => ({ ...i, id: i.id }))}
            rowKey={(r) => r.id}
          />
        )}
      </PanelCard>

      {showAdd ? (
        <AddIpModal
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            reload();
          }}
          onToast={setToast}
        />
      ) : null}

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

function AddIpModal({
  onClose,
  onAdded,
  onToast,
}: {
  onClose: () => void;
  onAdded: () => void;
  onToast: (msg: string) => void;
}) {
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startAdd] = useTransition();

  function handleSubmit() {
    setErr(null);
    if (!cidr.trim()) { setErr("CIDR / IP 를 입력하세요."); return; }
    startAdd(async () => {
      const r = await addIpAllowlistAction({ cidr: cidr.trim(), label: label.trim() });
      if (!r.ok) {
        setErr(r.message);
        return;
      }
      onToast(`등록 완료: ${r.data.entry.cidr}`);
      onAdded();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/30">
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 relative space-y-4">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">CIDR / IP 추가</h3>
        <p className="text-xs text-muted">예: 203.0.113.45 또는 203.0.113.0/24</p>

        <div className="space-y-3">
          <label className="block text-xs text-slate-600">
            CIDR <span className="text-rose-500">*</span>
            <input
              type="text"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              placeholder="203.0.113.0/24"
              disabled={pending}
            />
          </label>
          <label className="block text-xs text-slate-600">
            라벨
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="본사 VPN"
              disabled={pending}
            />
          </label>
        </div>

        {err ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {err}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose} disabled={pending}>
            취소
          </button>
          <button
            className="btn-primary text-sm disabled:opacity-60"
            type="button"
            onClick={handleSubmit}
            disabled={pending || !cidr.trim()}
          >
            {pending ? "추가 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
