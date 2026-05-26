"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { DataTable, type Column } from "../../_components/DataTable";
import { StatCard } from "../../_components/StatCard";
import type {
  AdminCommerceOrderRow,
  AdminCommerceOrderDetail,
  AdminCommerceOrderStatus,
} from "@/lib/adminApi";
import {
  listAdminOrdersAction,
  getAdminOrderAction,
  updateAdminOrderStatusAction,
} from "@/lib/actions/commerceAdmin";

// (주)숨코리아 출시 정비 — 커머스 주문 관리.
//
// Server `/api/v1/admin/commerce/orders*` (requireAdmin). 결제수단/카드 정보는
// SERVER 가 admin endpoint 응답에서 의도적으로 제외 (PIPA 최소수집 원칙). 본 화면은
// 상태 흐름 (pending → paid → shipping → done | cancelled) 만 관리.

const PAGE_SIZE = 25;

type LoadError = { message: string; unreachable: boolean } | null;

function classifyError(message: string): LoadError {
  const unreachable =
    message.startsWith("ERR_NETWORK") ||
    message.startsWith("ERR_SERVER_UNAVAILABLE") ||
    message.includes("not_found") ||
    message.includes("준비") ||
    message === "Not Found";
  return { message, unreachable };
}

const STATUS_OPTIONS: { value: AdminCommerceOrderStatus | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "결제대기" },
  { value: "paid", label: "결제완료" },
  { value: "shipping", label: "배송중" },
  { value: "done", label: "완료" },
  { value: "cancelled", label: "취소" },
];

const STATUS_CHIP: Record<AdminCommerceOrderStatus, string> = {
  pending: "chip chip-warn",
  paid: "chip chip-info",
  shipping: "chip chip-info",
  done: "chip chip-success",
  cancelled: "chip chip-error",
};

const STATUS_LABEL: Record<AdminCommerceOrderStatus, string> = {
  pending: "결제대기",
  paid: "결제완료",
  shipping: "배송중",
  done: "완료",
  cancelled: "취소",
};

export default function CommerceOrdersPage() {
  const [items, setItems] = useState<AdminCommerceOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AdminCommerceOrderStatus | "all">("all");
  const [error, setError] = useState<LoadError>(null);
  const [loading, startLoad] = useTransition();
  const [picked, setPicked] = useState<AdminCommerceOrderRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(() => {
    startLoad(async () => {
      const r = await listAdminOrdersAction({
        status,
        page,
        page_size: PAGE_SIZE,
      });
      if (!r.ok) {
        setError(classifyError(r.message));
        setItems([]);
        setTotal(0);
      } else {
        setError(null);
        setItems(r.data.items ?? []);
        setTotal(r.data.total ?? 0);
      }
    });
  }, [status, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  const summary = useMemo(() => {
    const byStatus = new Map<AdminCommerceOrderStatus, number>();
    for (const o of items) {
      byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
    }
    const revenue = items
      .filter((o) => o.status === "paid" || o.status === "shipping" || o.status === "done")
      .reduce((s, o) => s + (o.total ?? 0), 0);
    return {
      pending: byStatus.get("pending") ?? 0,
      paid: byStatus.get("paid") ?? 0,
      done: byStatus.get("done") ?? 0,
      revenue,
    };
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  type Row = AdminCommerceOrderRow;
  const columns: Column<Row>[] = [
    {
      key: "id",
      header: "주문 ID",
      render: (r) => <span className="font-mono text-[11px]">{r.id}</span>,
    },
    {
      key: "user",
      header: "사용자",
      render: (r) => (
        <span className="font-mono text-xs">{r.user_email ?? r.user_id}</span>
      ),
    },
    {
      key: "items",
      header: "항목",
      align: "right",
      render: (r) => r.item_count,
    },
    {
      key: "total",
      header: "합계",
      align: "right",
      render: (r) => (
        <span className="font-mono text-sm">
          {(r.total ?? 0).toLocaleString()}
          <span className="ml-0.5 text-[10px] text-muted">
            {r.currency ?? "KRW"}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (r) => (
        <span className={STATUS_CHIP[r.status]}>{STATUS_LABEL[r.status]}</span>
      ),
    },
    {
      key: "created",
      header: "주문일",
      render: (r) => <span className="text-xs text-muted">{r.created_at}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button
          className="btn-outline text-xs"
          type="button"
          onClick={() => setPicked(r)}
        >
          상세
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="전체 주문 (서버)"
          value={String(total)}
          hint="Server total"
          accent="blue"
        />
        <StatCard
          label="현재 페이지 결제대기"
          value={String(summary.pending)}
          hint="status = pending"
          accent="orange"
        />
        <StatCard
          label="현재 페이지 완료"
          value={String(summary.done)}
          hint="status = done"
          accent="teal"
        />
        <StatCard
          label="현재 페이지 매출"
          value={`${summary.revenue.toLocaleString()} KRW`}
          hint="paid + shipping + done 합"
          accent="pink"
        />
      </section>

      <PanelCard
        title="주문 목록 (Server 정본)"
        description="Server /api/v1/admin/commerce/orders — paginated. 상태 변경은 사유 5자 이상 + Server audit_log."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        {error ? (
          error.unreachable ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 mb-3">
              <div className="font-medium">준비 중</div>
              <div className="mt-1 text-xs text-muted">
                Server 신규 admin endpoint{" "}
                <code>/api/v1/admin/commerce/orders</code> 가 아직 도달 가능하지
                않습니다. SERVER 배포가 끝나면 자동으로 표시됩니다.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
              조회 실패: {error.message}
            </div>
          )
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          <label className="sm:col-span-1 flex items-center gap-2 text-xs text-slate-700">
            상태 필터
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as AdminCommerceOrderStatus | "all");
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm flex-1"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DataTable
          columns={columns}
          rows={items.map((o) => ({ ...o }))}
          rowKey={(r) => r.id}
          empty="해당 조건의 주문이 없습니다."
          pageSize={0}
        />

        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>
            전체 {total.toLocaleString()}건 · {page} / {totalPages} 페이지
          </span>
          <div className="flex items-center gap-1">
            <button
              className="rounded-lg px-2.5 py-1 bg-white/60 border border-white/60 disabled:opacity-40"
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              이전
            </button>
            <button
              className="rounded-lg px-2.5 py-1 bg-white/60 border border-white/60 disabled:opacity-40"
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              다음
            </button>
          </div>
        </div>
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

      {picked ? (
        <OrderDetailDrawer
          order={picked}
          onClose={() => setPicked(null)}
          onStatusChanged={(msg) => {
            setToast(msg);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function OrderDetailDrawer({
  order,
  onClose,
  onStatusChanged,
}: {
  order: AdminCommerceOrderRow;
  onClose: () => void;
  onStatusChanged: (toast: string) => void;
}) {
  const [detail, setDetail] = useState<AdminCommerceOrderDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [nextStatus, setNextStatus] = useState<AdminCommerceOrderStatus>(order.status);
  const [reason, setReason] = useState("");

  useEffect(() => {
    startBusy(async () => {
      const r = await getAdminOrderAction({ id: order.id });
      if (r.ok) {
        setDetail(r.data);
      } else {
        setErr(r.message);
      }
    });
  }, [order.id]);

  function apply() {
    if (nextStatus === order.status) {
      setErr("이미 같은 상태입니다.");
      return;
    }
    if (reason.trim().length < 5) {
      setErr("사유는 5자 이상.");
      return;
    }
    startBusy(async () => {
      const r = await updateAdminOrderStatusAction({
        id: order.id,
        status: nextStatus,
        reason: reason.trim(),
      });
      if (!r.ok) {
        setErr(r.message);
        return;
      }
      setErr(null);
      onStatusChanged(
        `주문 ${order.id} 상태 ${STATUS_LABEL[order.status]} → ${STATUS_LABEL[nextStatus]} 변경.`,
      );
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/30">
      <div className="w-full max-w-xl glass-panel rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">주문 상세</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{order.id}</p>

        {err ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
          <Field label="사용자">
            <span className="font-mono">{order.user_email ?? order.user_id}</span>
          </Field>
          <Field label="주문일">{order.created_at}</Field>
          <Field label="합계">
            <span className="font-mono">
              {(order.total ?? 0).toLocaleString()}{" "}
              {order.currency ?? "KRW"}
            </span>
          </Field>
          <Field label="현재 상태">
            <span className={STATUS_CHIP[order.status]}>
              {STATUS_LABEL[order.status]}
            </span>
          </Field>
        </div>

        <div className="mt-5">
          <div className="text-xs text-muted mb-2">
            주문 항목 ({detail?.items.length ?? order.item_count})
          </div>
          {busy && !detail ? (
            <div className="text-xs text-muted">로딩...</div>
          ) : detail && detail.items.length === 0 ? (
            <div className="text-xs text-muted">항목 없음.</div>
          ) : (
            <ul className="space-y-2">
              {detail?.items.map((it, idx) => (
                <li
                  key={`${it.product_id}-${idx}`}
                  className="rounded-lg bg-white/55 border border-white/50 p-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">
                      {it.product_name}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {it.product_id}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                    <span>
                      {it.unit_price.toLocaleString()} × {it.quantity}
                    </span>
                    <span className="font-mono text-slate-700">
                      {it.line_total.toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 rounded-xl bg-white/60 border border-white/60 p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">
            상태 변경
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as AdminCommerceOrderStatus)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {(["pending", "paid", "shipping", "done", "cancelled"] as AdminCommerceOrderStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="사유 (5자 이상)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              minLength={5}
            />
          </div>
          <button
            type="button"
            onClick={apply}
            disabled={busy}
            className="w-full rounded-xl bg-accent text-white text-sm py-2 disabled:opacity-60"
          >
            상태 변경 적용
          </button>
          <p className="text-[11px] text-muted">
            ※ 결제수단/카드 정보는 admin 응답에서 의도적으로 제외 (PIPA 최소수집).
            상태 변경은 Server audit_log 기록.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white/55 border border-white/50 px-3 py-2">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="text-sm text-slate-800 font-medium">{children}</div>
    </div>
  );
}
