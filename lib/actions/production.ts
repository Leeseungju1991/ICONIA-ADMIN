"use server";

// V3.0 #14 — 양산 LOT / 시리얼 / 출고 테스트 server actions.
//
// Server endpoints (Phase1-A, commit 841f6e0):
//   POST /api/v1/admin/lots
//   POST /api/v1/admin/lots/:lot_id/serials/batch
//   POST /api/v1/admin/factory-test  (운영자 JWT 또는 FACTORY_TOKEN)

import { readSession } from "@/lib/authCookie";
import {
  createProductionLot,
  batchIssueSerials,
  submitFactoryTest,
  type ProductionLotRow,
} from "@/lib/adminApi";

export type CreateLotResult =
  | { ok: true; lot: ProductionLotRow }
  | { ok: false; message: string; code?: string };

export async function createLotAction(formData: FormData): Promise<CreateLotResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다." };

  const lot_code = String(formData.get("lot_code") || "").trim();
  const plannedQtyStr = String(formData.get("planned_qty") || "");
  const notes = String(formData.get("notes") || "").trim();

  if (!/^LOT-[0-9]{4}$/.test(lot_code)) {
    return { ok: false, message: "lot_code 는 LOT-#### 형식이어야 합니다 (예: LOT-0001)." };
  }
  const planned_qty = plannedQtyStr ? Number(plannedQtyStr) : undefined;
  if (planned_qty !== undefined && (!Number.isFinite(planned_qty) || planned_qty < 0)) {
    return { ok: false, message: "planned_qty 는 0 이상의 정수여야 합니다." };
  }

  const res = await createProductionLot({
    jwt,
    lot_code,
    planned_qty,
    notes: notes || undefined,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, lot: res.data.lot };
}

export type BatchIssueResult =
  | {
      ok: true;
      lot_id: string;
      count: number;
      serials: Array<{ serial: string; qr_token: string }>;
    }
  | { ok: false; message: string; code?: string };

export async function batchIssueSerialsAction(
  formData: FormData,
): Promise<BatchIssueResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다." };

  const lotId = String(formData.get("lot_id") || "").trim();
  const countStr = String(formData.get("count") || "");
  const serial_prefix = String(formData.get("serial_prefix") || "").trim();

  if (!lotId) return { ok: false, message: "LOT id 를 입력하세요." };
  const count = Number(countStr);
  if (!Number.isFinite(count) || count < 1 || count > 5000) {
    return { ok: false, message: "count 는 1 이상 5000 이하 정수." };
  }

  const res = await batchIssueSerials({
    jwt,
    lotId,
    count,
    serial_prefix: serial_prefix || undefined,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, ...res.data };
}

export type SubmitFactoryTestResult =
  | { ok: true; serial: string; passed: boolean; test_result_id: string }
  | { ok: false; message: string; code?: string };

export async function submitFactoryTestAction(
  formData: FormData,
): Promise<SubmitFactoryTestResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다." };

  const serial = String(formData.get("serial") || "").trim();
  if (!serial) return { ok: false, message: "serial 을 입력하세요." };

  const boolOf = (k: string): boolean | undefined => {
    const v = formData.get(k);
    if (v === null || v === "") return undefined;
    return v === "true" || v === "on";
  };
  const httpsRttStr = String(formData.get("https_rtt_ms") || "");
  const https_rtt_ms = httpsRttStr ? Number(httpsRttStr) : undefined;

  const res = await submitFactoryTest({
    jwt,
    serial,
    results: {
      camera_ok: boolOf("camera_ok"),
      mic_ok: boolOf("mic_ok"),
      speaker_ok: boolOf("speaker_ok"),
      battery_ok: boolOf("battery_ok"),
      wifi_ok: boolOf("wifi_ok"),
      ...(typeof https_rtt_ms === "number" && Number.isFinite(https_rtt_ms)
        ? { https_rtt_ms }
        : {}),
    },
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, ...res.data };
}
