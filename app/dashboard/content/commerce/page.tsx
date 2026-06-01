"use client";

// 커머스 상품 가격 정보 (Server `/api/v1/admin/commerce/products` 정본).
// 2026-05-28 — localStorage mock 폐기. server CRUD 연동.
// 2026-05-28 — 자동 새로고침 토글 (visibility-aware 10s polling + 신규 상품 highlight).

import { useEffect, useRef, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { AutoRefreshToggle } from "../../_components/AutoRefreshToggle";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import {
  listAdminCommerceProductsAction,
  createAdminCommerceProductAction,
  deleteAdminCommerceProductAction,
  type ListProductsResult,
} from "@/lib/actions/adminCommerce";
import type { AdminCommerceProductRow } from "@/lib/adminApi";

export default function CommercePage() {
  const [state, setState] = useState<ListProductsResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [creating, startCreate] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [autoOn, setAutoOn] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  function diffAndMarkNew(items: AdminCommerceProductRow[]) {
    const incoming = new Set(items.map((p) => p.id));
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
    } else {
      const added: string[] = [];
      incoming.forEach((id) => {
        if (!knownIdsRef.current.has(id)) added.push(id);
      });
      if (added.length > 0) {
        setNewIds((prev) => {
          const next = new Set(prev);
          added.forEach((id) => next.add(id));
          return next;
        });
        setTimeout(() => {
          setNewIds((prev) => {
            const next = new Set(prev);
            added.forEach((id) => next.delete(id));
            return next;
          });
        }, 1200);
      }
    }
    knownIdsRef.current = incoming;
  }

  function reload() {
    startLoad(async () => {
      const r = await listAdminCommerceProductsAction({ page_size: 100 });
      setState(r);
      if (r.ok) diffAndMarkNew(r.items);
    });
  }

  async function pollOnce(): Promise<boolean> {
    const r = await listAdminCommerceProductsAction({ page_size: 100 });
    setState(r);
    if (r.ok) {
      diffAndMarkNew(r.items);
      return true;
    }
    return false;
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useAutoRefresh(pollOnce, {
    intervalMs: 10000,
    enabled: autoOn,
    maxFailures: 3,
    onResult: ({ ok }) => {
      if (!ok) setToast("일시 연결 끊김 — 다음 갱신에서 재시도");
    },
    onMaxFailures: () => {
      setAutoOn(false);
      setToast("자동 갱신 중지 — 3회 연속 실패로 폴링을 중단했습니다.");
    },
  });

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const priceStr = String(fd.get("price") || "").trim();
    const description = String(fd.get("description") || "").trim();
    const category = String(fd.get("category") || "").trim();
    const stockStr = String(fd.get("stock") || "0").trim();
    const price = Number(priceStr);
    const stock = Number(stockStr);
    if (name.length < 1 || !Number.isFinite(price) || price < 0) {
      setToast("상품명과 가격(0 이상)을 정확히 입력하세요.");
      return;
    }
    startCreate(async () => {
      const r = await createAdminCommerceProductAction({
        name,
        price: Math.floor(price),
        description: description || undefined,
        category: category || undefined,
        stock: Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : 0,
      });
      if (!r.ok) {
        setToast(`추가 실패: ${r.message}`);
        return;
      }
      setToast(`추가됨: ${r.product.name}`);
      form.reset();
      reload();
    });
  }

  function handleRemove(p: AdminCommerceProductRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`이 상품을 제거하시겠습니까?\n\n${p.name}`)
    ) {
      return;
    }
    startCreate(async () => {
      const r = await deleteAdminCommerceProductAction({ id: p.id });
      if (!r.ok) {
        setToast(`제거 실패: ${r.message}`);
        return;
      }
      setToast(`제거됨: ${p.name}`);
      reload();
    });
  }

  const items: AdminCommerceProductRow[] = state && state.ok ? state.items : [];

  return (
    <div className="space-y-6">
      <PanelCard title="커머스 상품 추가">
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            name="name"
            placeholder="상품명"
            className="sm:col-span-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            required
          />
          <input
            name="price"
            placeholder="가격 (원)"
            inputMode="numeric"
            className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            required
          />
          <input
            name="stock"
            placeholder="재고"
            inputMode="numeric"
            defaultValue="0"
            className="sm:col-span-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            name="category"
            placeholder="카테고리 (선택)"
            className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="sm:col-span-2 rounded-lg bg-accent px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {creating ? "처리 중..." : "추가"}
          </button>
          <input
            name="description"
            placeholder="상품 설명 (선택)"
            className="sm:col-span-12 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </form>
      </PanelCard>

      <PanelCard
        title={`상품 목록${state && state.ok ? ` (${state.total}개)` : ""}`}
        actions={
          <>
            <AutoRefreshToggle
              enabled={autoOn}
              onToggle={setAutoOn}
              lastRefreshedAt={refresh.lastRefreshedAt}
            />
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {loading ? "조회 중..." : "새로고침"}
            </button>
          </>
        }
      >
        {!state ? (
          <div className="text-sm text-muted">불러오는 중</div>
        ) : !state.ok ? (
          <div className="text-sm text-rose-700">불러오기 실패: {state.message}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted">등록된 상품이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-slate-200">
                  <th className="px-2 py-2 font-medium">사진</th>
                  <th className="px-2 py-2 font-medium">상품명</th>
                  <th className="px-2 py-2 font-medium">카테고리</th>
                  <th className="px-2 py-2 font-medium text-right">가격</th>
                  <th className="px-2 py-2 font-medium text-right">재고</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    className={
                      "border-b border-slate-100 hover:bg-slate-50 " +
                      (newIds.has(p.id) ? "row-new-highlight" : "")
                    }
                    data-testid={newIds.has(p.id) ? "product-row-new" : "product-row"}
                  >
                    <td className="px-2 py-2">
                      {p.image_url ? (
                        <span className="relative inline-block w-12 h-12">
                          {/* 2026-06-01 P0 fix — 시드 데이터의 awscdn.dollsoom.com URL 다수가
                              dead-link. onError 발생 시 placeholder 로 교체하여 깨진 이미지
                              아이콘이 노출되지 않도록 한다. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.image_url}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                            loading="lazy"
                            onError={(e) => {
                              const t = e.currentTarget;
                              t.style.display = "none";
                              const sib = t.nextElementSibling as HTMLElement | null;
                              if (sib) sib.style.display = "flex";
                            }}
                          />
                          <span
                            className="absolute inset-0 rounded-lg bg-slate-100 items-center justify-center text-[9px] text-slate-400"
                            style={{ display: "none" }}
                            aria-label="이미지 로드 실패"
                          >
                            n/a
                          </span>
                        </span>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100" />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-800 inline-flex items-center gap-2">
                        {newIds.has(p.id) ? (
                          <span className="chip chip-success" aria-label="신규 상품">NEW</span>
                        ) : null}
                        {p.name}
                      </div>
                      {p.description ? (
                        <div className="text-xs text-muted line-clamp-1">{p.description}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-600">{p.category ?? "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {p.price.toLocaleString()}{p.currency === "USD" ? "$" : "원"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.stock}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemove(p)}
                        className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700"
                      >
                        제거
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
