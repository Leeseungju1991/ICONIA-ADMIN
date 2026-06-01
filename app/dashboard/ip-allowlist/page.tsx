"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";

// 운영자 IP 허용목록 — Server 정본 endpoint(`/api/v1/operator/admin/ip-allowlist`)
// 도입 후 실 연동 예정. 본 라운드는 client 시그니처와 UI 골격 + graceful 분기.
//
// 정책: 본 허용목록에 등록된 IP 만 운영자 콘솔 로그인 가능. 등록은 superadmin
// 만 가능. 비상시(예: VPN 다운) 본인 IP 임시 등록을 위한 break-glass 흐름은
// 후속 라운드 (out-of-band 인증 필요).

type IpEntry = {
  id: string;
  cidr: string;
  label: string;
  added_by: string;
  added_at: string;
  last_seen_at: string | null;
};

type ListResult =
  | { ok: true; items: IpEntry[] }
  | { ok: false; message: string; code?: string };

async function listIpAllowlistAction(): Promise<ListResult> {
  // Server endpoint 미구현 — 본 라운드는 client 시그니처만 준비. 실 연동 시
  // 본 함수를 `lib/actions/ipAllowlist.ts` server action 으로 교체.
  return {
    ok: false,
    code: "ERR_NOT_IMPLEMENTED",
    message: "Server `/api/v1/operator/admin/ip-allowlist` 미구현 (다음 라운드).",
  };
}

export default function IpAllowlistPage() {
  const [items, setItems] = useState<IpEntry[]>([]);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [loading, startLoad] = useTransition();
  const [showAdd, setShowAdd] = useState(false);

  function reload() {
    startLoad(async () => {
      const r = await listIpAllowlistAction();
      if (!r.ok) {
        setError({ code: r.code, message: r.message });
        setItems([]);
      } else {
        setError(null);
        setItems(r.items);
      }
    });
  }

  useEffect(() => {
    reload();
  }, []);

  const columns: Column<IpEntry & { id: string }>[] = [
    { key: "cidr", header: "CIDR / IP", render: (r) => <span className="font-mono text-sm">{r.cidr}</span> },
    { key: "label", header: "라벨", render: (r) => r.label },
    { key: "added_by", header: "등록자", render: (r) => <span className="font-mono text-xs">{r.added_by}</span> },
    { key: "added_at", header: "등록일", render: (r) => <span className="text-xs text-muted">{r.added_at}</span> },
    {
      key: "last_seen_at",
      header: "최근 로그인",
      render: (r) => <span className="text-xs text-muted">{r.last_seen_at ?? "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (_r) => (
        <button type="button" className="btn-outline text-xs" disabled>
          삭제
        </button>
      ),
    },
  ];

  const notImplemented = error?.code === "ERR_NOT_IMPLEMENTED";

  return (
    <div className="space-y-6">
      <PanelCard
        title="운영자 IP 허용목록"
        description="등록된 IP 에서만 운영자 콘솔 로그인이 가능합니다. 추가·삭제는 최고관리자 전용입니다."
        actions={
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            disabled={notImplemented}
            className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
          >
            CIDR 추가
          </button>
        }
      >
        {notImplemented ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div className="font-medium">Server endpoint 미구현</div>
            <div className="mt-1 text-xs text-muted">
              본 화면은 client UI 골격만 완비됨. Server `/api/v1/operator/admin/ip-allowlist` (GET/POST/DELETE) 도입 후 자동 활성.
            </div>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-xs text-muted">데이터 없음</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            등록된 IP 가 없습니다.
            {loading ? " (불러오는 중)" : ""}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={items.map((i) => ({ ...i, id: i.id }))}
            rowKey={(r) => r.id}
          />
        )}
      </PanelCard>

      {showAdd ? (
        <AddIpModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); reload(); }} />
      ) : null}
    </div>
  );
}

function AddIpModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/30">
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 relative">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">CIDR / IP 추가</h3>
        <p className="text-xs text-muted mt-1">예: 203.0.113.45 또는 203.0.113.0/24</p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-600">
            CIDR
            <input
              type="text"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              placeholder="203.0.113.0/24"
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
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose}>취소</button>
          <button
            className="btn-primary text-sm"
            type="button"
            disabled
            title="Server endpoint 미구현"
            onClick={onAdded}
          >
            추가 (미구현)
          </button>
        </div>
      </div>
    </div>
  );
}
