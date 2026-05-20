import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({
  disableOperator: vi.fn(),
  listOperators: vi.fn(),
  getOperatorMe: vi.fn(),
}));

import { disableOperator, listOperators, getOperatorMe } from "@/lib/adminApi";
import { revalidatePath } from "next/cache";
import { disableOperatorAction, listOperatorsAction } from "./operators";

const mockedDisable = disableOperator as unknown as ReturnType<typeof vi.fn>;
const mockedList = listOperators as unknown as ReturnType<typeof vi.fn>;
const mockedGetMe = getOperatorMe as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidate = revalidatePath as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mockedDisable.mockReset();
  mockedList.mockReset();
  mockedGetMe.mockReset();
  mockedRevalidate.mockReset();
  // 기본: Server /operator/me 도달 불가 → disableOperatorAction 의 self-disable
  // 가드는 JWT payload fallback 으로 동작 (resolveIdentity).
  mockedGetMe.mockResolvedValue({
    ok: false,
    code: "ERR_NETWORK",
    message: "network_error",
    status: 0,
  });
});

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

function makeJwt(payload: Record<string, unknown>): string {
  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${enc({ alg: "RS256", typ: "JWT" })}.${enc(payload)}.sig`;
}

describe("disableOperatorAction", () => {
  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await disableOperatorAction(fd({ operator_id: "o1", reason: "left company" }));
    expect(r.ok).toBe(false);
    expect(mockedDisable).not.toHaveBeenCalled();
  });

  it("returns error when operator_id or reason missing", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await disableOperatorAction(fd({ operator_id: "o1" }));
    expect(r.ok).toBe(false);
    expect(mockedDisable).not.toHaveBeenCalled();
  });

  it("calls disableOperator + revalidates operators page on success", async () => {
    cookieStore.get.mockReturnValue({ value: "j-xyz" });
    mockedDisable.mockResolvedValue({ ok: true, data: { ok: true } });
    const r = await disableOperatorAction(fd({ operator_id: "o1", reason: "offboarded" }));
    expect(r).toEqual({ ok: true });
    expect(mockedDisable).toHaveBeenCalledWith({ jwt: "j-xyz", operatorId: "o1", reason: "offboarded" });
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/operators");
  });

  it("surfaces API error (e.g. cannot disable last superadmin) and does not revalidate", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedDisable.mockResolvedValue({
      ok: false,
      code: "ERR_OPERATOR_LAST_SUPERADMIN",
      message: "cannot disable last superadmin",
      status: 409,
    });
    const r = await disableOperatorAction(fd({ operator_id: "o1", reason: "offboarded" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_OPERATOR_LAST_SUPERADMIN");
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it("blocks self-disable when current operator sub matches operator_id (defense in depth)", async () => {
    cookieStore.get.mockReturnValue({
      value: makeJwt({ sub: "me", email: "me@example.com", role: "superadmin" }),
    });
    const r = await disableOperatorAction(fd({ operator_id: "me", reason: "i am leaving" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/본인 계정/);
    expect(mockedDisable).not.toHaveBeenCalled();
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it("allows disabling a different operator even when current sub is present", async () => {
    cookieStore.get.mockReturnValue({
      value: makeJwt({ sub: "me", email: "me@example.com", role: "superadmin" }),
    });
    mockedDisable.mockResolvedValue({ ok: true, data: { ok: true } });
    const r = await disableOperatorAction(fd({ operator_id: "other", reason: "offboarded" }));
    expect(r).toEqual({ ok: true });
    expect(mockedDisable).toHaveBeenCalled();
  });

  it("rejects a reason shorter than 5 characters (server-side guard)", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await disableOperatorAction(fd({ operator_id: "o1", reason: "abc" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/5자/);
    expect(mockedDisable).not.toHaveBeenCalled();
  });

  it("blocks self-disable using server-verified identity even when JWT sub is forged", async () => {
    // 위·변조된 JWT 는 sub=other 라 우회를 시도하지만, Server /operator/me 가
    // 정본 id=me 를 반환하므로 self-disable 가드가 동작해야 한다.
    cookieStore.get.mockReturnValue({
      value: makeJwt({ sub: "other", email: "x@example.com", role: "superadmin" }),
    });
    mockedGetMe.mockResolvedValue({
      ok: true,
      data: { id: "me", email: "me@example.com", role: "superadmin" },
    });
    const r = await disableOperatorAction(fd({ operator_id: "me", reason: "i am leaving" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/본인 계정/);
    expect(mockedDisable).not.toHaveBeenCalled();
  });
});

describe("listOperatorsAction", () => {
  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await listOperatorsAction();
    expect(r.ok).toBe(false);
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("returns operators on success", async () => {
    cookieStore.get.mockReturnValue({ value: "j-xyz" });
    const operators = [
      {
        id: "o1",
        email: "op@example.com",
        role: "cs",
        totp_enrolled: true,
        last_login_at: null,
        disabled_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    mockedList.mockResolvedValue({ ok: true, data: { operators } });
    const r = await listOperatorsAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.operators).toEqual(operators);
    expect(mockedList).toHaveBeenCalledWith({ jwt: "j-xyz" });
  });

  it("surfaces API error with a human message", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedList.mockResolvedValue({
      ok: false,
      code: "ERR_FORBIDDEN",
      message: "forbidden",
      status: 403,
    });
    const r = await listOperatorsAction();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_FORBIDDEN");
  });
});
