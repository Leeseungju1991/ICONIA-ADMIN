"use client";

import { useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import {
  createLotAction,
  batchIssueSerialsAction,
  submitFactoryTestAction,
  type CreateLotResult,
  type BatchIssueResult,
  type SubmitFactoryTestResult,
} from "@/lib/actions/production";

// V3.0 #14 / 양산직전 #15 — 양산 LOT 생성 · 시리얼 발급 · 출고 테스트 결과 입력.
//
// 양산 라인에서 펌웨어 production_test (1.HW) 가 자동 업로드하는 경로와 별도로,
// 운영자가 수동으로 검수 결과를 입력하거나 LOT/시리얼을 관리하는 화면이다.

export default function FactoryTestPage() {
  return (
    <div className="space-y-4">
      <PanelCard
        title="양산 관리 — LOT / 시리얼 / 출고 테스트"
        description="LOT 생성·시리얼 발급·출고 테스트 결과를 수동으로 입력합니다."
      >
        <div className="text-xs text-muted">
          ★ 시리얼은 1회 발급 후 변경 불가 — 발급 즉시 QR 토큰을 공장 PC 로 받아 인쇄·NVS burn 에 사용하세요.
        </div>
      </PanelCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LotCreatePanel />
        <SerialBatchPanel />
      </div>

      <FactoryTestSubmitPanel />
    </div>
  );
}

function LotCreatePanel() {
  const [state, setState] = useState<CreateLotResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <PanelCard title="① 생산 LOT 생성">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await createLotAction(fd);
            setState(r);
          });
        }}
        className="space-y-3"
      >
        <LabeledInput
          label="LOT 코드"
          name="lot_code"
          placeholder="LOT-0001"
          required
          monospace
        />
        <LabeledInput
          label="계획 수량"
          name="planned_qty"
          placeholder="500"
          type="number"
          monospace
        />
        <LabeledTextarea label="메모 (선택)" name="notes" placeholder="공급사·제조 라인 등" />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-2xl bg-accent px-4 py-2 text-sm text-white shadow-card disabled:opacity-60"
        >
          {isPending ? "생성 중..." : "LOT 생성"}
        </button>
      </form>
      <ResultRow state={state}>
        {state && state.ok ? (
          <div className="text-sm">
            ✓ <span className="font-mono">{state.lot.lot_code}</span> 생성됨 (id:{" "}
            <span className="font-mono text-xs">{state.lot.id}</span>, planned_qty={" "}
            {state.lot.planned_qty}, status: {state.lot.status})
          </div>
        ) : null}
      </ResultRow>
    </PanelCard>
  );
}

function SerialBatchPanel() {
  const [state, setState] = useState<BatchIssueResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <PanelCard title="② 시리얼 일괄 발급">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await batchIssueSerialsAction(fd);
            setState(r);
          });
        }}
        className="space-y-3"
      >
        <LabeledInput label="LOT id" name="lot_id" placeholder="UUID" required monospace />
        <LabeledInput
          label="발급 수량"
          name="count"
          type="number"
          placeholder="50"
          required
          monospace
        />
        <LabeledInput
          label="시리얼 prefix (선택)"
          name="serial_prefix"
          placeholder="IC"
          monospace
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-2xl bg-accent px-4 py-2 text-sm text-white shadow-card disabled:opacity-60"
        >
          {isPending ? "발급 중..." : "시리얼 발급"}
        </button>
      </form>
      <ResultRow state={state}>
        {state && state.ok ? (
          <div className="text-sm">
            <div className="mb-1">
              ✓ {state.count}개 발급 완료. CSV 다운로드:{" "}
              <DownloadSerialsButton serials={state.serials} lotId={state.lot_id} />
            </div>
            <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-white/60 p-2 text-[11px]">
              {state.serials
                .slice(0, 10)
                .map((s) => `${s.serial}  ${s.qr_token}`)
                .join("\n")}
              {state.serials.length > 10 ? `\n... (+${state.serials.length - 10}건)` : ""}
            </pre>
          </div>
        ) : null}
      </ResultRow>
    </PanelCard>
  );
}

function FactoryTestSubmitPanel() {
  const [state, setState] = useState<SubmitFactoryTestResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <PanelCard
      title="③ 출고 테스트 결과 수동 입력"
      description="자동 업로드되지 않은 출고 테스트 결과를 직접 입력합니다."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await submitFactoryTestAction(fd);
            setState(r);
          });
        }}
        className="space-y-3"
      >
        <LabeledInput label="시리얼" name="serial" placeholder="IC-A1B2C3D4" required monospace />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Checkbox name="camera_ok" label="카메라 정상" />
          <Checkbox name="mic_ok" label="마이크 정상" />
          <Checkbox name="speaker_ok" label="스피커 정상" />
          <Checkbox name="battery_ok" label="배터리 정상" />
          <Checkbox name="wifi_ok" label="Wi-Fi 정상" />
          <LabeledInput
            label="HTTPS RTT (ms)"
            name="https_rtt_ms"
            placeholder="124"
            type="number"
            monospace
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-2xl bg-accent px-4 py-2 text-sm text-white shadow-card disabled:opacity-60"
        >
          {isPending ? "업로드 중..." : "테스트 결과 업로드"}
        </button>
      </form>
      <ResultRow state={state}>
        {state && state.ok ? (
          <div className="text-sm">
            <span className={state.passed ? "chip chip-success" : "chip chip-error"}>
              {state.passed ? "PASS" : "FAIL"}
            </span>{" "}
            <span className="font-mono">{state.serial}</span> · 결과 id{" "}
            <span className="font-mono text-xs">{state.test_result_id}</span>
          </div>
        ) : null}
      </ResultRow>
    </PanelCard>
  );
}

/* ---------------- 보조 컴포넌트 ---------------- */

function LabeledInput({
  label,
  name,
  type = "text",
  placeholder,
  required,
  monospace,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  monospace?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-muted">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 outline-none focus:border-accent ${
          monospace ? "font-mono text-sm" : ""
        }`}
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-muted">{label}</span>
      <textarea
        name={name}
        placeholder={placeholder}
        rows={2}
        className="mt-1 w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} value="true" className="h-4 w-4" />
      {label}
    </label>
  );
}

function ResultRow({
  state,
  children,
}: {
  state: { ok: boolean; message?: string; code?: string } | null;
  children?: React.ReactNode;
}) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        실패 ({state.code ?? "ERR"}): {state.message}
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
      {children}
    </div>
  );
}

function DownloadSerialsButton({
  serials,
  lotId,
}: {
  serials: Array<{ serial: string; qr_token: string }>;
  lotId: string;
}) {
  function onClick() {
    const csv = ["serial,qr_token", ...serials.map((s) => `${s.serial},${s.qr_token}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `serials-${lotId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-accent px-2 py-1 text-xs text-white"
    >
      CSV
    </button>
  );
}
