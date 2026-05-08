import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const cookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: () => cookieStore,
}));

import {
  AUTH_COOKIE_NAME,
  writeSession,
  clearSession,
  readSession,
} from "./authCookie";

beforeEach(() => {
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  cookieStore.get.mockReset();
  process.env.ICONIA_SERVER_URL = "https://api.example.com";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function setNodeEnv(v: string) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = v;
}

describe("writeSession", () => {
  it("sets cookie with httpOnly + sameSite=strict + computed maxAge", () => {
    setNodeEnv("production");
    writeSession({ jwt: "j", expiresAt: "2026-05-08T10:30:00.000Z" });
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const call = cookieStore.set.mock.calls[0][0];
    expect(call.name).toBe(AUTH_COOKIE_NAME);
    expect(call.value).toBe("j");
    expect(call.httpOnly).toBe(true);
    expect(call.sameSite).toBe("strict");
    expect(call.path).toBe("/");
    expect(call.secure).toBe(true);
    expect(call.maxAge).toBe(30 * 60);
  });

  it("uses secure=false when not production", () => {
    setNodeEnv("development");
    writeSession({ jwt: "j", expiresAt: "2026-05-08T10:30:00.000Z" });
    expect(cookieStore.set.mock.calls[0][0].secure).toBe(false);
  });

  it("clamps maxAge to >= 1 second when already past", () => {
    setNodeEnv("development");
    writeSession({ jwt: "j", expiresAt: "2026-05-08T09:00:00.000Z" });
    expect(cookieStore.set.mock.calls[0][0].maxAge).toBe(1);
  });
});

describe("clearSession", () => {
  it("calls cookies().delete with cookie name", () => {
    clearSession();
    expect(cookieStore.delete).toHaveBeenCalledWith(AUTH_COOKIE_NAME);
  });
});

describe("readSession", () => {
  it("returns the cookie value when present", () => {
    cookieStore.get.mockReturnValue({ value: "abc" });
    expect(readSession()).toBe("abc");
  });

  it("returns null when cookie absent", () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(readSession()).toBeNull();
  });
});
