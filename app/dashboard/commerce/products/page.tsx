"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { DataTable, type Column } from "../../_components/DataTable";
import { StatCard } from "../../_components/StatCard";
import type {
  AdminCommerceProductRow,
  CreateProductInput,
} from "@/lib/adminApi";
import {
  listAdminProductsAction,
  createAdminProductAction,
  updateAdminProductAction,
  deleteAdminProductAction,
} from "@/lib/actions/commerceAdmin";

// (주)숨코리아 출시 정비 — 커머스 상품 관리.
//
// Server `/api/v1/admin/commerce/products*` (requireAdmin) — SERVER 동시 작업 endpoint.
// 미배포 단계에서는 ERR_NETWORK / ERR_SERVER_UNAVAILABLE → "준비 중" 안내 + 빈 테이블 +
// 페이지 자체 정상 렌더 (다른 메뉴로 이동 가능).

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

type EditState =
  | { mode: "create" }
  | { mode: "edit"; product: AdminCommerceProductRow }
  | null;

export default function CommerceProductsPage() {
  const [items, setItems] = useState<AdminCommerceProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [onlyZeroStock, setOnlyZeroStock] = useState(false);
  const [error, setError] = useState<LoadError>(null);
  const [loading, startLoad] = useTransition();
  const [edit, setEdit] = useState<EditState>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(() => {
    startLoad(async () => {
      const r = await listAdminProductsAction({
        q: q.trim() || undefined,
        category: category.trim() || undefined,
        only_zero_stock: onlyZeroStock,
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
  }, [q, category, onlyZeroStock, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  const summary = useMemo(() => {
    const inStock = items.filter((p) => p.stock > 0).length;
    const outOfStock = items.filter((p) => p.stock <= 0).length;
    const totalStock = items.reduce((s, p) => s + (p.stock ?? 0), 0);
    return { inStock, outOfStock, totalStock };
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleDelete(p: AdminCommerceProductRow) {
    if (typeof window !== "undefined") {
      const phrase = window.prompt(
        `상품 삭제 (soft delete)\n\n실행하려면 정확히 "DELETE" 를 입력하세요.\n\n${p.name}`,
      );
      if (phrase !== "DELETE") {
        setToast("실행 취소 — 확인 문구 불일치.");
        return;
      }
    }
    const r = await deleteAdminProductAction({ id: p.id });
    if (!r.ok) {
      setToast(`삭제 실패: ${r.message}`);
      return;
    }
    setToast(`상품 ${p.id} 삭제 완료.`);
    reload();
  }

  type Row = AdminCommerceProductRow;
  const columns: Column<Row>[] = [
    {
      key: "id",
      header: "ID",
      render: (r) => <span className="font-mono text-[11px]">{r.id}</span>,
    },
    {
      key: "name",
      header: "상품명",
      render: (r) => (
        <span className="font-medium text-slate-800">{r.name}</span>
      ),
    },
    {
      key: "category",
      header: "카테고리",
      render: (r) =>
        r.category ? (
          <span className="chip chip-info">{r.category}</span>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
    {
      key: "price",
      header: "가격",
      align: "right",
      render: (r) => (
        <span className="font-mono text-sm">
          {(r.price ?? 0).toLocaleString()}
          <span className="ml-0.5 text-[10px] text-muted">
            {r.currency ?? "KRW"}
          </span>
        </span>
      ),
    },
    {
      key: "stock",
      header: "재고",
      align: "right",
      render: (r) =>
        r.stock > 0 ? (
          <span className="font-mono text-sm">{r.stock}</span>
        ) : (
          <span className="chip chip-error">품절</span>
        ),
    },
    {
      key: "created",
      header: "등록일",
      render: (r) => <span className="text-xs text-muted">{r.created_at}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex gap-1 justify-end">
          <button
            className="btn-outline text-xs"
            type="button"
            onClick={() => setEdit({ mode: "edit", product: r })}
          >
            수정
          </button>
          <button
            className="btn-danger text-xs"
            type="button"
            onClick={() => handleDelete(r)}
          >
            삭제
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="전체 상품 (서버)"
          value={String(total)}
          hint="Server total"
          accent="blue"
        />
        <StatCard
          label="현재 페이지 재고 있음"
          value={String(summary.inStock)}
          hint="stock > 0"
          accent="teal"
        />
        <StatCard
          label="현재 페이지 품절"
          value={String(summary.outOfStock)}
          hint="stock ≤ 0"
          accent="pink"
        />
        <StatCard
          label="현재 페이지 재고 합"
          value={String(summary.totalStock)}
          hint="현재 페이지 재고 합산"
          accent="orange"
        />
      </section>

      <PanelCard
        title="상품 목록 (Server 정본)"
        description="Server /api/v1/admin/commerce/products — paginated. 등록/수정/삭제는 Server mutation."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-xl bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300 disabled:opacity-60"
            >
              {loading ? "조회 중..." : "새로고침"}
            </button>
            <button
              type="button"
              onClick={() => setEdit({ mode: "create" })}
              className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white"
            >
              + 새 상품
            </button>
          </div>
        }
      >
        {error ? (
          error.unreachable ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 mb-3">
              <div className="font-medium">준비 중</div>
              <div className="mt-1 text-xs text-muted">
                Server 신규 admin endpoint{" "}
                <code>/api/v1/admin/commerce/products</code> 가 아직 도달
                가능하지 않습니다. SERVER 배포가 끝나면 자동으로 표시됩니다.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
              조회 실패: {error.message}
            </div>
          )
        ) : null}

        <form
          className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            reload();
          }}
        >
          <input
            type="text"
            placeholder="검색 (상품명)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="카테고리"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={onlyZeroStock}
              onChange={(e) => {
                setOnlyZeroStock(e.target.checked);
                setPage(1);
              }}
            />
            품절만 보기
          </label>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 text-white text-xs px-3 py-2"
          >
            검색 적용
          </button>
        </form>

        <DataTable
          columns={columns}
          rows={items.map((p) => ({ ...p }))}
          rowKey={(r) => r.id}
          empty="해당 조건의 상품이 없습니다."
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

      {edit ? (
        <ProductEditModal
          state={edit}
          onClose={() => setEdit(null)}
          onSaved={(msg) => {
            setEdit(null);
            setToast(msg);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function ProductEditModal({
  state,
  onClose,
  onSaved,
}: {
  state: Exclude<EditState, null>;
  onClose: () => void;
  onSaved: (toast: string) => void;
}) {
  const isCreate = state.mode === "create";
  const initial: CreateProductInput =
    state.mode === "edit"
      ? {
          name: state.product.name,
          description: state.product.description ?? "",
          price: state.product.price,
          category: state.product.category ?? "",
          image_url: state.product.image_url ?? "",
          stock: state.product.stock,
        }
      : { name: "", description: "", price: 0, category: "", image_url: "", stock: 0 };

  const [form, setForm] = useState<CreateProductInput>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function field<K extends keyof CreateProductInput>(
    key: K,
    value: CreateProductInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startBusy(async () => {
      const payload: CreateProductInput = {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        price: Number(form.price),
        category: form.category?.trim() || undefined,
        image_url: form.image_url?.trim() || undefined,
        stock: Number(form.stock),
      };
      const r = isCreate
        ? await createAdminProductAction(payload)
        : await updateAdminProductAction({
            id: (state as { product: AdminCommerceProductRow }).product.id,
            patch: payload,
          });
      if (!r.ok) {
        setErr(r.message);
        return;
      }
      onSaved(isCreate ? `상품 ${r.product.id} 등록 완료.` : `상품 ${r.product.id} 수정 완료.`);
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/30">
      <div className="w-full max-w-lg glass-panel rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">
          {isCreate ? "새 상품 등록" : "상품 수정"}
        </h3>
        {!isCreate && state.mode === "edit" ? (
          <p className="text-xs text-muted mt-0.5 font-mono">
            {state.product.id}
          </p>
        ) : null}

        {err ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <form className="mt-5 space-y-3 text-sm" onSubmit={submit}>
          <FormField label="상품명">
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </FormField>
          <FormField label="설명">
            <textarea
              value={form.description ?? ""}
              onChange={(e) => field("description", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[80px]"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="가격 (KRW)">
              <input
                required
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => field("price", Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </FormField>
            <FormField label="재고">
              <input
                required
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => field("stock", Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="카테고리">
              <input
                value={form.category ?? ""}
                onChange={(e) => field("category", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="예: 인형/액세서리"
              />
            </FormField>
            <FormField label="이미지 URL">
              <input
                value={form.image_url ?? ""}
                onChange={(e) => field("image_url", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </FormField>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="submit"
              className="rounded-xl bg-accent text-white text-sm py-2 disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "저장 중..." : isCreate ? "등록" : "저장"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white border border-slate-300 text-slate-700 text-sm py-2"
            >
              취소
            </button>
          </div>
          <p className="text-[11px] text-muted">
            ※ 모든 변경은 Server audit_log 자동 기록 (operator_id + diff).
          </p>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] text-muted mb-1">{label}</span>
      {children}
    </label>
  );
}
