"use client";

// 커머스 상품 상세 페이지 (사용자 요청 항목 13).
// 2026-06-02 — 신규.
//
// 표시 정보: 사진, 상품명, 설명, 가격(KRW), 재고, 카테고리, 활성 상태,
//   생성/수정 시각, 최근 주문 수(서버 추정).
//
// 데이터 출처: getAdminCommerceProductAction.
// 현재 SERVER 에 GET /products/:id endpoint 가 없어 목록을 받아 client-side filter
// 하는 임시 처리 (TODO: SERVER 라우트 추가 후 직접 호출로 교체).
//
// 최근 주문 수는 listOrdersAction 으로 최근 100건 주문을 받아 해당 product_id 가
// 포함된 주문 수를 추정한다. 정확한 카운트가 필요할 경우 SERVER 측에
// `?product_id=` 필터 라우트 추가 필요 (TODO).

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../../../_components/PanelCard";
import { LoadingState, EmptyState } from "../../../_components/CardStates";
import {
  getAdminCommerceProductAction,
  type ProductDetailResult,
} from "@/lib/actions/adminCommerce";
import { listOrdersAction } from "@/lib/actions/commerceOrders";
import { getOrderDetailAction } from "@/lib/actions/commerceOrders";
import type { AdminCommerceProductRow } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";

type Params = { params: { productId: string } };

function fmtKRW(amount: number, currency?: string): string {
  if (!Number.isFinite(amount)) return `${amount} ${currency ?? ""}`.trim();
  if (currency === "USD") return `$${amount.toLocaleString("en-US")}`;
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR");
}

function stockLabel(p: AdminCommerceProductRow): string {
  switch (p.stock_status) {
    case "instock":
      return "재고 있음";
    case "outofstock":
      return "품절";
    case "onbackorder":
      return "백오더";
    default:
      return p.stock > 0 ? "재고 있음" : "품절";
  }
}

function stockChip(p: AdminCommerceProductRow): string {
  switch (p.stock_status) {
    case "instock":
      return "chip chip-success";
    case "outofstock":
      return "chip chip-error";
    case "onbackorder":
      return "chip chip-warn";
    default:
      return p.stock > 0 ? "chip chip-success" : "chip chip-error";
  }
}

export default function CommerceProductDetailPage({ params }: Params) {
  const productId = decodeURIComponent(params.productId);
  const [state, setState] = useState<ProductDetailResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [recentOrders, setRecentOrders] = useState<number | null>(null);
  const [orderCountLoading, setOrderCountLoading] = useState(false);

  function reload() {
    startLoad(async () => {
      const r = await getAdminCommerceProductAction({ id: productId });
      setState(r);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // 최근 주문 수 추정 — 최근 100건 주문을 fetch 하고 각 주문 detail 의 items
  // 에서 product_id 가 일치하는 주문 수를 센다. SERVER 가 직접 카운트 API 를
  // 노출하면 본 블록을 단일 fetch 로 교체.
  // TODO(server): GET /api/v1/admin/commerce/orders/list?product_id= 추가 후 단순화.
  useEffect(() => {
    let cancelled = false;
    async function compute() {
      setOrderCountLoading(true);
      try {
        const list = await listOrdersAction({ limit: 50 });
        if (!list.ok) {
          if (!cancelled) setRecentOrders(null);
          return;
        }
        // detail fetch 는 N 번이라 50건으로 cap. 더 큰 데이터셋은 서버에
        // 필터 라우트가 생기기 전까지 정확하지 않음을 UI 에서 명시.
        let count = 0;
        for (const o of list.items) {
          if (cancelled) return;
          const d = await getOrderDetailAction({ id: o.id });
          if (!d.ok) continue;
          const items = d.order.items ?? [];
          if (items.some((it) => it.product_id === productId)) count += 1;
        }
        if (!cancelled) setRecentOrders(count);
      } finally {
        if (!cancelled) setOrderCountLoading(false);
      }
    }
    compute();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const product: AdminCommerceProductRow | null =
    state && state.ok ? state.product : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/content/commerce"
          className="text-sm text-accent hover:underline"
        >
          ← 상품 목록으로
        </Link>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {loading ? "조회 중..." : "새로고침"}
        </button>
      </div>

      {!state ? (
        <LoadingState />
      ) : !state.ok ? (
        <EmptyState
          title="상품을 불러올 수 없습니다."
          hint={messageForCode(state.code, state.message)}
        />
      ) : product ? (
        <>
          <PanelCard title={product.name} description={`상품 ID: ${product.id}`}>
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-6">
              <div>
                {/* 사진 — 목록과 동일한 placeholder-under-img 전략(2026-06-02 fix(2)). */}
                <div className="relative w-40 h-40 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center text-xs text-slate-400">
                  <span aria-hidden>이미지 없음</span>
                  {product.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="absolute inset-0 w-40 h-40 object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  ) : null}
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <Field label="상태">
                  {product.is_deleted ? (
                    <span className="chip chip-muted">아카이브됨</span>
                  ) : (
                    <span className="chip chip-success">활성</span>
                  )}
                </Field>
                <Field label="가격">
                  <span className="tabular-nums text-slate-800">
                    {fmtKRW(product.price, product.currency)}
                  </span>
                </Field>
                <Field label="재고">
                  <span className="tabular-nums text-slate-800 mr-2">
                    {product.stock}
                  </span>
                  <span className={stockChip(product)}>{stockLabel(product)}</span>
                </Field>
                <Field label="카테고리">
                  <span className="text-slate-700">{product.category ?? "—"}</span>
                </Field>
                <Field label="생성일">
                  <span className="text-slate-700">{fmtDate(product.created_at)}</span>
                </Field>
                <Field label="수정일">
                  <span className="text-slate-700">{fmtDate(product.updated_at)}</span>
                </Field>
              </div>
            </div>
          </PanelCard>

          <PanelCard title="설명">
            {product.description ? (
              <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                {product.description}
              </div>
            ) : (
              <div className="text-sm text-muted">상품 설명이 없습니다.</div>
            )}
          </PanelCard>

          <PanelCard
            title="최근 주문 수"
            description="최근 주문 50건을 스캔해 본 상품이 포함된 주문 수를 추정한 값입니다. 정확한 집계는 서버 필터 API 추가 후 제공됩니다."
          >
            {orderCountLoading ? (
              <LoadingState label="주문 데이터 스캔 중..." />
            ) : recentOrders === null ? (
              <div className="text-sm text-muted">집계 불가</div>
            ) : (
              <div className="text-2xl font-semibold text-slate-800 tabular-nums">
                {recentOrders}
                <span className="text-sm text-muted font-normal ml-2">건</span>
              </div>
            )}
            <div className="mt-3">
              <Link
                href="/dashboard/commerce/orders"
                className="text-xs text-accent hover:underline"
              >
                주문 전체 보기 →
              </Link>
            </div>
          </PanelCard>
        </>
      ) : (
        <EmptyState title="상품 정보 없음" />
      )}
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
    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div>{children}</div>
    </div>
  );
}
