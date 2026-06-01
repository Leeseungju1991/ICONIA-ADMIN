"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { LoadingState, EmptyState } from "../../_components/CardStates";
import {
  listOrdersAction,
  getOrderDetailAction,
  type OrdersListResult,
} from "@/lib/actions/commerceOrders";
import type { CommerceOrderDetail, CommerceOrderListItem } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";

// 2026-06-01 — 주문 read-only.
// CLAUDE.md §2 — 결제·환불 액션 절대 추가 금지. 본 파일은 mutation 없음.

const STATUS_CHIP: Record<string, string> = {
  pending: "chip chip-warn",
  processing: "chip chip-info",
  on_hold: "chip chip-warn",
  completed: "chip chip-success",
  cancelled: "chip chip-muted",
  refunded: "chip chip-muted",
  failed: "chip chip-error",
};

function fmtKRW(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isFinite(n)) {
    if (currency === "KRW") return `₩${n.toLocaleString("ko-KR")}`;
    return `${n.toLocaleString("ko-KR")} ${currency}`;
  }
  return `${amount} ${currency}`;
}

export default function OrdersClient() {
  const [state, setState] = useState<OrdersListResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<CommerceOrderDetail | null>(null);
  const [detailLoading, startDetail] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listOrdersAction({
        status: statusFilter || undefined,
        limit: 100,
      });
      setState(r);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openDetail(row: CommerceOrderListItem) {
    startDetail(async () => {
      const r = await getOrderDetailAction({ id: row.id });
      if (!r.ok) {
        // graceful: 상세 조회 실패 시 목록 row 정보만 표시.
        setSelected({ ...row, items: [] });
        return;
      }
      setSelected(r.order);
    });
  }

  const items: CommerceOrderListItem[] = state && state.ok ? state.items : [];

  return (
    <div className="space-y-6">
      <PanelCard
        title="주문 목록 (display-only)"
        description="조회 전용 화면입니다. 결제·환불은 외부 시스템에서 처리됩니다."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
            >
              <option value="">전체 상태</option>
              <option value="pending">pending</option>
              <option value="processing">processing</option>
              <option value="on_hold">on_hold</option>
              <option value="completed">completed</option>
              <option value="cancelled">cancelled</option>
              <option value="refunded">refunded</option>
              <option value="failed">failed</option>
            </select>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-xl bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300"
            >
              {loading ? "조회 중..." : "새로고침"}
            </button>
          </div>
        }
      >
        {!state ? (
          <LoadingState />
        ) : !state.ok ? (
          <EmptyState
            title="조회할 수 없음"
            hint={messageForCode(state.code, state.message)}
          />
        ) : items.length === 0 ? (
          <EmptyState title="주문이 없습니다." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted">
                  <th className="px-2 py-1">order_id</th>
                  <th className="px-2 py-1">user_email</th>
                  <th className="px-2 py-1">total</th>
                  <th className="px-2 py-1">status</th>
                  <th className="px-2 py-1">created_at</th>
                  <th className="px-2 py-1">상세</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => openDetail(o)}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-2 py-2 font-mono text-xs text-slate-700">
                      {o.id.slice(0, 12)}…
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-700">
                      {o.customer_email ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-700">
                      {fmtKRW(o.total, o.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <span className={STATUS_CHIP[o.status] ?? "chip chip-muted"}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-xs text-accent">보기 →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      {selected ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            className="absolute inset-0 bg-slate-900/40"
            aria-label="닫기"
            onClick={() => setSelected(null)}
          />
          <aside className="relative ml-auto h-full w-full max-w-xl bg-white border-l border-slate-200 shadow-card overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  주문 {selected.id.slice(0, 12)}…
                </div>
                <div className="text-[11px] text-muted">
                  {new Date(selected.created_at).toLocaleString("ko-KR")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-sm"
              >
                닫기
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <Field label="user_email" value={selected.customer_email ?? "—"} />
              <Field
                label="status"
                value={selected.status}
                chip={STATUS_CHIP[selected.status]}
              />
              <Field
                label="total"
                value={fmtKRW(selected.total, selected.currency)}
              />
              <Field label="paid_at" value={selected.paid_at ?? "—"} />
              <Field label="completed_at" value={selected.completed_at ?? "—"} />
              <Field label="payment_method" value={selected.payment_method ?? "—"} />
              <div>
                <div className="text-[11px] text-muted mb-1">items</div>
                {selected.items && selected.items.length > 0 ? (
                  <ul className="space-y-1 text-xs text-slate-700">
                    {selected.items.map((it) => (
                      <li
                        key={it.id}
                        className="rounded border border-slate-200 bg-slate-50/50 px-2 py-1"
                      >
                        <div className="font-medium text-slate-800">{it.name}</div>
                        <div className="text-[11px] text-muted">
                          {it.sku ?? "—"} · qty {it.quantity} · subtotal{" "}
                          {fmtKRW(it.subtotal, selected.currency)}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : detailLoading ? (
                  <div className="text-xs text-muted">불러오는 중...</div>
                ) : (
                  <div className="text-xs text-muted">상세 항목이 없습니다.</div>
                )}
              </div>
              <div className="text-[11px] text-muted">
                * 본 화면은 display-only — 결제·환불 mutation 비구현.
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  chip,
}: {
  label: string;
  value: string;
  chip?: string;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      {chip ? (
        <span className={chip}>{value}</span>
      ) : (
        <div className="text-sm text-slate-700">{value}</div>
      )}
    </div>
  );
}
