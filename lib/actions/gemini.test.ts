// 2026-06-02 — upsertGeminiKeyQuotaAction 의 models 정식 컬럼 전달 검증.
//
// 본 테스트는 SERVER 가 PUT /api/v1/admin/gemini/keys/:alias/quota body 에
// `models: { text, image, diary, tts, stt }` 를 정식 컬럼으로 받도록 확장된 라운드
// 에서 추가됨. 이전엔 운영자가 선택한 모델이 `note` 안 `__models__=` prefix 로
// 임시 인코딩 — 그 임시 처리는 GeminiClient.tsx 에서 제거되었다.

import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("@/lib/httpClient", () => ({ authedRequest: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({ updateGeminiKeyQuota: vi.fn() }));

import { updateGeminiKeyQuota } from "@/lib/adminApi";
import {
  upsertGeminiKeyQuotaAction,
  updateGeminiKeyTierAction,
} from "./gemini";

const mockedUpdate = updateGeminiKeyQuota as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mockedUpdate.mockReset();
});

describe("upsertGeminiKeyQuotaAction", () => {
  it("세션 만료 시 update 호출 안 함", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await upsertGeminiKeyQuotaAction({
      alias: "AIza#0",
      tier: "tier_1",
    });
    expect(r.ok).toBe(false);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("alias 누락 시 거부", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt" });
    const r = await upsertGeminiKeyQuotaAction({ alias: "  ", tier: "free" });
    expect(r.ok).toBe(false);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("models 가 server PUT body 로 정식 전달된다", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-z" });
    mockedUpdate.mockResolvedValue({
      ok: true,
      data: { key_alias: "AIza#0", tier: "tier_1" },
    });
    const r = await upsertGeminiKeyQuotaAction({
      alias: "AIza#0",
      tier: "tier_1",
      rpd: 1500,
      monthly_token_cap: 1_000_000,
      note: "결제 카드 A",
      models: {
        text: "gemini-2.0-flash",
        image: "gemini-2.0-pro",
        diary: "gemini-2.0-flash",
      },
    });
    expect(r.ok).toBe(true);
    expect(mockedUpdate).toHaveBeenCalledTimes(1);
    const arg = mockedUpdate.mock.calls[0][0];
    expect(arg.alias).toBe("AIza#0");
    expect(arg.tier).toBe("tier_1");
    expect(arg.rpd).toBe(1500);
    expect(arg.monthly_token_cap).toBe(1_000_000);
    // 가장 중요한 정합: 임시 `__models__=` prefix 가 아니라 정식 `models` 객체.
    expect(arg.models).toEqual({
      text: "gemini-2.0-flash",
      image: "gemini-2.0-pro",
      diary: "gemini-2.0-flash",
    });
    expect(arg.note).toBe("결제 카드 A");
    // note 에 더 이상 __models__= prefix 가 들어가지 않는다.
    expect(String(arg.note)).not.toContain("__models__=");
  });

  it("models 미지정 시 null 로 전달 (server 가 unknown field 처럼 무시 또는 무변경)", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-z" });
    mockedUpdate.mockResolvedValue({
      ok: true,
      data: { key_alias: "AIza#1", tier: "free" },
    });
    await upsertGeminiKeyQuotaAction({ alias: "AIza#1", tier: "free" });
    const arg = mockedUpdate.mock.calls[0][0];
    expect(arg.models).toBeNull();
  });

  it("server 에러를 그대로 surface", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-z" });
    mockedUpdate.mockResolvedValue({
      ok: false,
      code: "ERR_VALIDATION",
      message: "invalid tier",
      status: 400,
    });
    const r = await upsertGeminiKeyQuotaAction({
      alias: "AIza#2",
      tier: "tier_3",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_VALIDATION");
      expect(r.message).toBe("invalid tier");
    }
  });
});

describe("updateGeminiKeyTierAction", () => {
  it("성공 시 정규화된 결과 반환", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt" });
    mockedUpdate.mockResolvedValue({
      ok: true,
      data: { key_alias: "AIza#3", tier: "tier_2" },
    });
    const r = await updateGeminiKeyTierAction({
      alias: "AIza#3",
      tier: "tier_2",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.alias).toBe("AIza#3");
      expect(r.tier).toBe("tier_2");
    }
  });
});
