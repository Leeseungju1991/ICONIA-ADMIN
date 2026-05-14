import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ServerResult } from "@/lib/types";
import type { RagSource, RagChunk, RagQueryData } from "@/lib/api/rag";

// Server Action 모듈을 mock — 클라이언트 패널이 import 해서 useTransition 으로 호출.
const getChunksAction = vi.fn();
const testQueryAction = vi.fn();
vi.mock("./actions", () => ({
  getChunksAction: (...a: unknown[]) => getChunksAction(...a),
  testQueryAction: (...a: unknown[]) => testQueryAction(...a),
}));

// mock 선언 후 import (vi.mock 은 hoist 되지만 명시적으로 동적 import).
import { SourcesPanel } from "./SourcesPanel";
import { ChunksPanel } from "./ChunksPanel";
import { QueryPanel } from "./QueryPanel";
import { KnowledgeConsole } from "./KnowledgeConsole";

beforeEach(() => {
  getChunksAction.mockReset();
  testQueryAction.mockReset();
});

const SOURCES: RagSource[] = [
  { id: "manual", title: "제품 매뉴얼", chunks: 3, updated_at: "2026-01-01T00:00:00.000Z" },
  { id: "faq", title: "FAQ", chunks: 5, updated_at: "2026-02-02T00:00:00.000Z" },
];

describe("SourcesPanel", () => {
  it("renders the sources from the result prop and calls onSelect on click", () => {
    const onSelect = vi.fn();
    render(<SourcesPanel result={{ ok: true, data: SOURCES }} onSelect={onSelect} />);
    expect(screen.getByTestId("sources-list")).toBeInTheDocument();
    expect(screen.getByText("제품 매뉴얼")).toBeInTheDocument();
    expect(screen.getByText("FAQ")).toBeInTheDocument();
    expect(screen.getByText(/id: manual/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("제품 매뉴얼"));
    expect(onSelect).toHaveBeenCalledWith("manual");
  });

  it("highlights the selected source", () => {
    render(<SourcesPanel result={{ ok: true, data: SOURCES }} selectedId="faq" onSelect={vi.fn()} />);
    const btn = screen.getByText("FAQ").closest("button")!;
    expect(btn.className).toContain("kb-item-active");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders the error message when result.ok === false", () => {
    const err: ServerResult<RagSource[]> = { ok: false, code: "ERR_X", message: "boom", status: 500 };
    render(<SourcesPanel result={err} onSelect={vi.fn()} />);
    expect(screen.getByText(/ERR_X: boom/)).toBeInTheDocument();
    expect(screen.queryByTestId("sources-list")).toBeNull();
  });

  it("renders the empty-state message when there are no sources", () => {
    render(<SourcesPanel result={{ ok: true, data: [] }} onSelect={vi.fn()} />);
    expect(screen.getByText(/등록된 소스 없음/)).toBeInTheDocument();
  });
});

describe("ChunksPanel", () => {
  it("shows the placeholder when no sourceId", () => {
    render(<ChunksPanel />);
    expect(screen.getByText(/소스를 선택하세요/)).toBeInTheDocument();
    expect(getChunksAction).not.toHaveBeenCalled();
  });

  it("calls getChunksAction with the sourceId and renders the returned chunks", async () => {
    const chunks: RagChunk[] = [
      { id: "manual#0", text: "보증 기간은 1년입니다." },
      { id: "manual#1", text: "두 번째 청크", location: { page: 2 } },
    ];
    getChunksAction.mockResolvedValue({ ok: true, data: chunks } satisfies ServerResult<RagChunk[]>);
    render(<ChunksPanel sourceId="manual" />);
    await waitFor(() => expect(getChunksAction).toHaveBeenCalledWith("manual"));
    await screen.findByTestId("chunks-list");
    expect(screen.getByText("manual#0")).toBeInTheDocument();
    expect(screen.getByText("보증 기간은 1년입니다.")).toBeInTheDocument();
    expect(screen.getByText(/page 2/)).toBeInTheDocument();
  });

  it("renders an error when getChunksAction fails", async () => {
    getChunksAction.mockResolvedValue({ ok: false, code: "ERR_RAG", message: "nope", status: 404 });
    render(<ChunksPanel sourceId="bad" />);
    await screen.findByText(/ERR_RAG: nope/);
  });
});

describe("QueryPanel", () => {
  it("submits, calls testQueryAction, and renders the answer + citations", async () => {
    const data: RagQueryData = {
      answer: "ICONIA 보증 기간은 1년입니다.",
      citations: [{ source_id: "manual#0", text: "보증 1년", score: 0.92, location: { page: 1 } }],
      backend: "mock",
      latency_ms: 12,
    };
    testQueryAction.mockResolvedValue({ ok: true, data } satisfies ServerResult<RagQueryData>);
    render(<QueryPanel />);
    fireEvent.change(screen.getByLabelText("질문"), { target: { value: "보증 기간?" } });
    fireEvent.click(screen.getByRole("button", { name: /실행/ }));
    await waitFor(() =>
      expect(testQueryAction).toHaveBeenCalledWith({ question: "보증 기간?", backendOverride: undefined }),
    );
    const result = await screen.findByTestId("query-result");
    expect(result).toHaveTextContent("ICONIA 보증 기간은 1년입니다.");
    expect(result).toHaveTextContent(/backend: mock/);
    expect(result).toHaveTextContent(/12ms/);
    expect(result).toHaveTextContent(/citations: 1/);
    expect(result).toHaveTextContent("manual#0");
  });

  it("passes backendOverride when a backend is chosen", async () => {
    testQueryAction.mockResolvedValue({
      ok: true,
      data: { answer: "a", citations: [], backend: "bedrock", latency_ms: 1 },
    } satisfies ServerResult<RagQueryData>);
    render(<QueryPanel />);
    fireEvent.change(screen.getByLabelText("질문"), { target: { value: "q" } });
    fireEvent.change(screen.getByLabelText("backend override"), { target: { value: "bedrock" } });
    fireEvent.click(screen.getByRole("button", { name: /실행/ }));
    await waitFor(() =>
      expect(testQueryAction).toHaveBeenCalledWith({ question: "q", backendOverride: "bedrock" }),
    );
  });

  it("does not submit when the question is blank", () => {
    render(<QueryPanel />);
    const btn = screen.getByRole("button", { name: /실행/ });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(testQueryAction).not.toHaveBeenCalled();
  });
});

describe("KnowledgeConsole", () => {
  it("wires source selection through to the chunks panel", async () => {
    getChunksAction.mockResolvedValue({ ok: true, data: [{ id: "manual#0", text: "본문" }] });
    render(<KnowledgeConsole sourcesResult={{ ok: true, data: SOURCES }} />);
    // 초기: chunks 패널은 placeholder
    expect(screen.getByText(/소스를 선택하세요/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("제품 매뉴얼"));
    await waitFor(() => expect(getChunksAction).toHaveBeenCalledWith("manual"));
    await screen.findByText("본문");
  });
});
