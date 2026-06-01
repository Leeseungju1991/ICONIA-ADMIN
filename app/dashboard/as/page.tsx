"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import {
  createAsTicketAction,
  replaceAsTicketAction,
  closeAsTicketAction,
  listAsTicketsAction,
  type AsActionResult,
} from "@/lib/actions/as";
import type { AsTicketRow, AsTicketStatus } from "@/lib/adminApi";

// V3.0 #20 — AS·교환 관리.
// AS 센터가 접수한 기기 / 교체 기기 / 회수 기기 상태를 한 화면에서 관리.
//
// 신규 티켓 생성 시 Server 가 device.force-unpair 를 자동 호출하여 이전 owner
// 페어링을 끊는다. 교체 기기 등록 시 Server 가 새 userDeviceLink 행을 생성.

const STATUS_CHIP: Record<AsTicketStatus, string> = {
  received: "chip chip-warn",
  in_repair: "chip chip-info",
  replaced: "chip chip-success",
  closed: "chip chip-muted",
};
const STATUS_LABEL: Record<AsTicketStatus, string> = {
  received: "접수",
  in_repair: "수리 중",
  replaced: "교체 완료",
  closed: "종료",
};

export default function AsPage() {
  const [filter, setFilter] = useState<AsTicketStatus | "all">("all");
  const [tickets, setTickets] = useState<AsTicketRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isReloading, startReload] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function reload() {
    startReload(async () => {
      setLoadError(null);
      const r = await listAsTicketsAction(
        filter === "all" ? { limit: 100 } : { status: filter, limit: 100 },
      );
      if (!r.ok) {
        setLoadError(r.message);
        setTickets([]);
        return;
      }
      setTickets(r.data.items);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="space-y-4">
      <PanelCard
        title="AS · 교환 티켓"
        description="AS 접수 시 기존 페어링은 자동 해제되고, 교체 기기 등록 시 새 페어링이 시작됩니다."
        actions={
          <select
            className="select max-w-[160px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">전체 상태</option>
            <option value="received">접수</option>
            <option value="in_repair">수리 중</option>
            <option value="replaced">교체 완료</option>
            <option value="closed">종료</option>
          </select>
        }
      >
        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Server 도달 실패: {loadError}
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-sm text-muted">{isReloading ? "불러오는 중" : "티켓이 없습니다."}</div>
        ) : (
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={STATUS_CHIP[t.status]}>{STATUS_LABEL[t.status]}</span>
                  <span className="font-mono text-xs">{t.id}</span>
                  <span className="text-xs text-muted">{t.opened_at}</span>
                </div>
                <div className="mt-1 text-xs">
                  <div>사용자 <span className="font-mono">{t.user_id}</span></div>
                  <div>회수 기기 <span className="font-mono">{t.device_id}</span></div>
                  {t.replacement_device_id ? (
                    <div>교체 기기 <span className="font-mono">{t.replacement_device_id}</span></div>
                  ) : null}
                  <div className="mt-1 text-muted">사유: {t.reason}</div>
                  {t.notes ? <div className="text-muted">메모: {t.notes}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CreateTicketPanel onDone={(msg) => { setToast(msg); reload(); }} />
        <ReplaceTicketPanel onDone={(msg) => { setToast(msg); reload(); }} />
        <CloseTicketPanel onDone={(msg) => { setToast(msg); reload(); }} />
      </div>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card">
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CreateTicketPanel({ onDone }: { onDone: (msg: string) => void }) {
  const [state, setState] = useState<AsActionResult<{ ticket: AsTicketRow; unpaired: number }> | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <PanelCard title="① 신규 티켓 접수">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await createAsTicketAction(fd);
            setState(r);
            if (r.ok) onDone(`티켓 ${r.data.ticket.id} 접수됨 (force-unpair: ${r.data.unpaired})`);
          });
        }}
        className="space-y-3 text-sm"
      >
        <Input name="user_id" label="사용자 UUID" placeholder="user UUID" required />
        <Input name="device_id" label="회수 기기 UUID" placeholder="device UUID" required />
        <Textarea name="reason" label="AS 사유 (5자 이상)" rows={2} required />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-2xl bg-accent px-4 py-2 text-white shadow-card disabled:opacity-60"
        >
          {isPending ? "접수 중..." : "티켓 접수"}
        </button>
      </form>
      <Result state={state} />
    </PanelCard>
  );
}

function ReplaceTicketPanel({ onDone }: { onDone: (msg: string) => void }) {
  const [state, setState] = useState<AsActionResult<AsTicketRow> | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <PanelCard title="② 교체 기기 등록">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await replaceAsTicketAction(fd);
            setState(r);
            if (r.ok) onDone(`티켓 ${r.data.id} 교체 등록됨 → ${r.data.replacement_device_id}`);
          });
        }}
        className="space-y-3 text-sm"
      >
        <Input name="id" label="티켓 id" placeholder="ticket UUID" required />
        <Input
          name="replacement_device_id"
          label="새 기기 UUID"
          placeholder="device UUID"
          required
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-2xl bg-accent px-4 py-2 text-white shadow-card disabled:opacity-60"
        >
          {isPending ? "처리 중..." : "교체 등록"}
        </button>
      </form>
      <Result state={state} />
    </PanelCard>
  );
}

function CloseTicketPanel({ onDone }: { onDone: (msg: string) => void }) {
  const [state, setState] = useState<AsActionResult<AsTicketRow> | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <PanelCard title="③ 티켓 종료">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await closeAsTicketAction(fd);
            setState(r);
            if (r.ok) onDone(`티켓 ${r.data.id} 종료됨`);
          });
        }}
        className="space-y-3 text-sm"
      >
        <Input name="id" label="티켓 id" placeholder="ticket UUID" required />
        <Textarea name="note" label="종료 메모 (5자 이상)" rows={2} required />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-2xl bg-accent px-4 py-2 text-white shadow-card disabled:opacity-60"
        >
          {isPending ? "처리 중..." : "티켓 종료"}
        </button>
      </form>
      <Result state={state} />
    </PanelCard>
  );
}

/* ---------------- 보조 컴포넌트 ---------------- */

function Input({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 font-mono text-xs outline-none focus:border-accent"
      />
    </label>
  );
}

function Textarea({
  name,
  label,
  rows,
  required,
}: {
  name: string;
  label: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-muted">{label}</span>
      <textarea
        name={name}
        rows={rows ?? 2}
        required={required}
        className="mt-1 w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function Result({ state }: { state: AsActionResult<unknown> | null }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        실패 ({state.code ?? "ERR"}): {state.message}
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
      ✓ 처리됨
    </div>
  );
}
