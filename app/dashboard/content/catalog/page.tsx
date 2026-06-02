"use client";

// 인형 도감 (Admin UI 단계 — localStorage mock store).
// 서버 endpoint 도입 시 본 페이지의 add/remove 만 server action 으로 교체.

import { useEffect, useState } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { DangerConfirmDialog } from "../../_components/DangerConfirmDialog";

type CatalogItem = {
  id: string;
  name: string;
  series?: string;
  description?: string;
};

const STORAGE_KEY = "iconia-admin:catalog-items";

function loadItems(): CatalogItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x.id === "string") : [];
  } catch {
    return [];
  }
}

function saveItems(items: CatalogItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [name, setName] = useState("");
  const [series, setSeries] = useState("");
  const [description, setDescription] = useState("");
  // V1.0 라운드 — window.confirm → DangerConfirmDialog 정합.
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const pendingRemoveName = pendingRemoveId
    ? items.find((it) => it.id === pendingRemoveId)?.name ?? null
    : null;

  useEffect(() => {
    setItems(loadItems());
  }, []);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 1) return;
    const next: CatalogItem = {
      id: `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      series: series.trim() || undefined,
      description: description.trim() || undefined,
    };
    const updated = [next, ...items];
    setItems(updated);
    saveItems(updated);
    setName("");
    setSeries("");
    setDescription("");
  }

  function handleRemove(id: string) {
    // 강력액션 정합 — 모달 트리거. 실제 제거는 confirmRemove.
    setPendingRemoveId(id);
  }

  function confirmRemove() {
    const id = pendingRemoveId;
    if (!id) return;
    setPendingRemoveId(null);
    const updated = items.filter((it) => it.id !== id);
    setItems(updated);
    saveItems(updated);
  }

  return (
    <div className="space-y-6">
      <PanelCard title="도감 항목 추가">
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="인형 이름"
            className="sm:col-span-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            required
          />
          <input
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            placeholder="시리즈 (선택)"
            className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-lg bg-accent px-3 py-2 text-sm text-white"
          >
            추가
          </button>
        </form>
      </PanelCard>

      <PanelCard title={`도감 목록 (${items.length})`}>
        {items.length === 0 ? (
          <div className="text-sm text-muted">등록된 도감 항목이 없습니다.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((it) => (
              <li
                key={it.id}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{it.name}</div>
                  <div className="text-xs text-slate-600">
                    {it.series ? <span>{it.series}</span> : null}
                    {it.description ? (
                      <span className="text-muted">
                        {it.series ? " · " : ""}
                        {it.description}
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(it.id)}
                  className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700 shrink-0"
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <DangerConfirmDialog
        open={pendingRemoveId !== null}
        title="도감 항목 제거"
        description="도감 항목을 목록에서 제거합니다."
        detail={
          pendingRemoveName ? (
            <span>대상: <b>{pendingRemoveName}</b></span>
          ) : (
            <span>대상 id: <code className="font-mono">{pendingRemoveId}</code></span>
          )
        }
        confirmLabel="제거"
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemoveId(null)}
      />
    </div>
  );
}
