"use client";

import { useState, useTransition } from "react";
import {
  generateBackupCodesAction,
  verifyBackupCodeAction,
  type GenerateBackupCodesResult,
  type VerifyBackupCodeResult,
} from "@/lib/actions/backupCodes";

// Phase 9 #5 — TOTP backup code (10개) 발급/검증 패널.
// 평문 코드는 응답에 1회만 — 사용자가 즉시 다운로드 또는 복사해야 함.
// Server: POST /api/v1/operator/totp/backup-codes/{generate,verify}

export default function BackupCodePanel() {
  const [genState, setGenState] = useState<GenerateBackupCodesResult | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyBackupCodeResult | null>(null);
  const [genPending, startGen] = useTransition();
  const [verifyPending, startVerify] = useTransition();
  const [verifyCode, setVerifyCode] = useState("");

  function runGenerate() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "백업 코드 10개를 새로 발급합니다.\n\n" +
          "⚠ 평문 코드는 응답에 한 번만 표시됩니다. 즉시 안전한 위치에 보관하세요.\n" +
          "기존 미사용 코드는 모두 무효화됩니다.\n\n계속하시겠습니까?",
      )
    ) {
      return;
    }
    startGen(async () => {
      const r = await generateBackupCodesAction();
      setGenState(r);
    });
  }

  function downloadCsv() {
    if (!genState || !genState.ok) return;
    const csv = ["index,code", ...genState.codes.map((c, i) => `${i + 1},${c}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iconia-totp-backup-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function runVerify(e: React.FormEvent) {
    e.preventDefault();
    startVerify(async () => {
      const r = await verifyBackupCodeAction({ code: verifyCode });
      setVerifyState(r);
      if (r.ok) setVerifyCode("");
    });
  }

  return (
    <div className="rounded-2xl border border-white/60 bg-white/55 p-5">
      <h2 className="text-lg font-semibold text-slate-800">백업 코드 (TOTP 복구)</h2>
      <p className="mt-1 text-sm text-muted">
        Authenticator 앱을 분실했을 때 1회용 백업 코드(10개)로 로그인할 수 있습니다.
        코드 1개당 1회 사용 후 자동 폐기됩니다.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runGenerate}
          disabled={genPending}
          className="rounded-xl bg-accent px-4 py-2 text-sm text-white shadow-card disabled:opacity-60"
        >
          {genPending ? "발급 중..." : "백업 코드 10개 발급"}
        </button>
        {genState?.ok ? (
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-xl bg-white/70 border border-white/70 px-4 py-2 text-sm text-slate-700"
          >
            CSV 다운로드
          </button>
        ) : null}
      </div>

      {genState && !genState.ok ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          발급 실패 ({genState.code ?? "ERR"}): {genState.message}
        </div>
      ) : null}
      {genState?.ok ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
          <div className="text-sm font-medium text-emerald-800 mb-2">
            ✓ {genState.count}개 발급됨 — 평문은 본 화면을 닫으면 다시 볼 수 없습니다.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-sm">
            {genState.codes.map((c, i) => (
              <div
                key={i}
                className="rounded-lg bg-white px-2 py-1.5 text-center border border-emerald-100"
              >
                {c}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <hr className="my-5 border-white/60" />

      <h3 className="text-sm font-semibold text-slate-800">백업 코드 검증 (분실 시)</h3>
      <form onSubmit={runVerify} className="mt-2 flex gap-2">
        <input
          type="text"
          value={verifyCode}
          onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
          placeholder="A2BCDE34"
          maxLength={16}
          className="flex-1 max-w-[200px] rounded-xl border border-white/70 bg-white/60 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={verifyPending || verifyCode.trim().length < 4}
          className="rounded-xl bg-accent px-4 py-2 text-sm text-white shadow-card disabled:opacity-60"
        >
          {verifyPending ? "검증 중..." : "검증"}
        </button>
      </form>
      {verifyState ? (
        verifyState.ok ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            ✓ 백업 코드 검증 성공. 남은 코드: {verifyState.remaining}개.
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            실패 ({verifyState.code ?? "ERR"}): {verifyState.message}
          </div>
        )
      ) : null}
    </div>
  );
}
