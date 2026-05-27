"use client";

// 커머스 상품 가격 정보 (Admin UI 단계 — localStorage mock store).
// 서버 endpoint 도입 시 본 페이지의 add/remove 만 server action 으로 교체.

import { useEffect, useState } from "react";
import { PanelCard } from "../../_components/PanelCard";

type CommerceItem = {
  id: string;
  name: string;
  price_krw: number;
  note?: string;
};

const STORAGE_KEY = "iconia-admin:commerce-items";

function loadItems(): CommerceItem[] {
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

function saveItems(items: CommerceItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function CommercePage() {
  const [items, setItems] = useState<CommerceItem[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setItems(loadItems());
  }, []);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = name.trim();
    const numericPrice = Number(price);
    if (trimmedName.length < 1 || !Number.isFinite(numericPrice) || numericPrice < 0) return;
    const next: CommerceItem = {
      id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      price_krw: Math.floor(numericPrice),
      note: note.trim() || undefined,
    };
    const updated = [next, ...items];
    setItems(updated);
    saveItems(updated);
    setName("");
    setPrice("");
    setNote("");
  }

  function handleRemove(id: string) {
    if (typeof window !== "undefined" && !window.confirm("이 상품을 제거하시겠습니까?")) return;
    const updated = items.filter((it) => it.id !== id);
    setItems(updated);
    saveItems(updated);
  }

  return (
    <div className="space-y-6">
      <PanelCard title="커머스 상품 추가">
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="상품명"
            className="sm:col-span-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            required
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="가격 (원)"
            inputMode="numeric"
            className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            required
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모 (선택)"
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

      <PanelCard title={`상품 목록 (${items.length})`}>
        {items.length === 0 ? (
          <div className="text-sm text-muted">등록된 상품이 없습니다.</div>
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
                    {it.price_krw.toLocaleString()}원
                    {it.note ? <span className="text-muted"> · {it.note}</span> : null}
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
    </div>
  );
}
