import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({
  pauseDeployment: vi.fn(),
  resumeDeployment: vi.fn(),
}));

import { pauseDeployment, resumeDeployment } from "@/lib/adminApi";
import { revalidatePath } from "next/cache";
import { pauseDeploymentAction, resumeDeploymentAction } from "./firmware";

const mockedPause = pauseDeployment as unknown as ReturnType<typeof vi.fn>;
const mockedResume = resumeDeployment as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidate = revalidatePath as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mockedPause.mockReset();
  mockedResume.mockReset();
  mockedRevalidate.mockReset();
});

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

describe("pauseDeploymentAction", () => {
  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await pauseDeploymentAction(fd({ deployment_id: "dep1" }));
    expect(r.ok).toBe(false);
    expect(mockedPause).not.toHaveBeenCalled();
  });

  it("returns error when deployment_id missing", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await pauseDeploymentAction(fd({ reason: "x" }));
    expect(r.ok).toBe(false);
    expect(mockedPause).not.toHaveBeenCalled();
  });

  it("calls pauseDeployment with reason + revalidates firmware page", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedPause.mockResolvedValue({ ok: true, data: { ok: true } });
    const r = await pauseDeploymentAction(fd({ deployment_id: "dep1", reason: "regression" }));
    expect(r).toEqual({ ok: true });
    expect(mockedPause).toHaveBeenCalledWith({ jwt: "j", deploymentId: "dep1", reason: "regression" });
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/firmware");
  });

  it("defaults reason to empty string when omitted", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedPause.mockResolvedValue({ ok: true, data: { ok: true } });
    await pauseDeploymentAction(fd({ deployment_id: "dep1" }));
    expect(mockedPause).toHaveBeenCalledWith({ jwt: "j", deploymentId: "dep1", reason: "" });
  });

  it("surfaces API error and does not revalidate", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedPause.mockResolvedValue({ ok: false, code: "ERR_DEPLOYMENT_NOT_FOUND", message: "nope", status: 404 });
    const r = await pauseDeploymentAction(fd({ deployment_id: "dep1" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_DEPLOYMENT_NOT_FOUND");
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });
});

describe("resumeDeploymentAction", () => {
  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await resumeDeploymentAction(fd({ deployment_id: "dep1" }));
    expect(r.ok).toBe(false);
    expect(mockedResume).not.toHaveBeenCalled();
  });

  it("returns error when deployment_id missing", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await resumeDeploymentAction(fd({}));
    expect(r.ok).toBe(false);
    expect(mockedResume).not.toHaveBeenCalled();
  });

  it("calls resumeDeployment + revalidates on success", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedResume.mockResolvedValue({ ok: true, data: { ok: true } });
    const r = await resumeDeploymentAction(fd({ deployment_id: "dep2" }));
    expect(r).toEqual({ ok: true });
    expect(mockedResume).toHaveBeenCalledWith({ jwt: "j", deploymentId: "dep2" });
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/firmware");
  });

  it("surfaces API error", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedResume.mockResolvedValue({ ok: false, code: "ERR_INVALID_STATE", message: "already done", status: 409 });
    const r = await resumeDeploymentAction(fd({ deployment_id: "dep2" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_INVALID_STATE");
  });
});
