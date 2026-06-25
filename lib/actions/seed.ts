"use server";

// (주)숨코리아 출시 정비 — Seed 상태 / 수동 트리거 server actions.
// SERVER 신규 endpoint `/api/v1/admin/seed/{status,run}`. 운영팀이 출시 직전 데모 데이터를
// 한 번 더 채워야 할 때 수동 실행. 모든 호출은 requireAdmin 게이트.

import { readSession } from "@/lib/authCookie";
import {
  getAdminSeedStatus,
  runAdminSeed,
  type AdminSeedStatus,
  type AdminSeedRunResult,
} from "@/lib/adminApi";

export type SeedStatusResult =
  | { ok: true; data: AdminSeedStatus }
  | { ok: false; message: string; code?: string };

export async function getSeedStatusAction(): Promise<SeedStatusResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await getAdminSeedStatus({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export type SeedRunResult =
  | { ok: true; data: AdminSeedRunResult }
  | { ok: false; message: string; code?: string };

export async function runSeedAction(input: { reason?: string }): Promise<SeedRunResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await runAdminSeed({ jwt, reason: input.reason });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
