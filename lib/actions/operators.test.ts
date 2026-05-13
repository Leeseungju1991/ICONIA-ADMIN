import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({
  disableOperator: vi.fn(),
}));

import { disableOperator } from "@/lib/adminApi";
import { revalidatePath } from "next/cache";
import { disableOperatorAction } from "./operators";

const mockedDisable = disableOperator as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidate = revalidatePath as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mockedDisable.mockReset();
  mockedRevalidate.mockReset();
});

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
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
});
