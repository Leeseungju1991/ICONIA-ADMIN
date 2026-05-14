import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadEnv, loadIdleTimeoutMinutes } from "./env";

function setNodeEnv(v: string) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = v;
}

describe("loadEnv", () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    original = { ...process.env };
  });

  afterEach(() => {
    process.env = original;
  });

  it("returns ICONIA_SERVER_URL when set", () => {
    process.env.ICONIA_SERVER_URL = "https://api.example.com";
    setNodeEnv("production");
    expect(loadEnv().ICONIA_SERVER_URL).toBe("https://api.example.com");
  });

  it("strips trailing slash from ICONIA_SERVER_URL", () => {
    process.env.ICONIA_SERVER_URL = "https://api.example.com/";
    expect(loadEnv().ICONIA_SERVER_URL).toBe("https://api.example.com");
  });

  it("throws when ICONIA_SERVER_URL is missing", () => {
    delete process.env.ICONIA_SERVER_URL;
    expect(() => loadEnv()).toThrow(/ICONIA_SERVER_URL/);
  });

  it("throws when ICONIA_SERVER_URL is not http(s)", () => {
    process.env.ICONIA_SERVER_URL = "ftp://example.com";
    expect(() => loadEnv()).toThrow(/ICONIA_SERVER_URL/);
  });

  it("COOKIE_SECURE=true when NODE_ENV=production", () => {
    process.env.ICONIA_SERVER_URL = "https://api.example.com";
    setNodeEnv("production");
    expect(loadEnv().COOKIE_SECURE).toBe(true);
  });

  it("COOKIE_SECURE=false when NODE_ENV is not production", () => {
    process.env.ICONIA_SERVER_URL = "https://api.example.com";
    setNodeEnv("development");
    expect(loadEnv().COOKIE_SECURE).toBe(false);
  });
});

describe("loadIdleTimeoutMinutes", () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    original = { ...process.env };
  });

  afterEach(() => {
    process.env = original;
  });

  it("defaults to 30 when ADMIN_IDLE_TIMEOUT_MINUTES is unset", () => {
    delete process.env.ADMIN_IDLE_TIMEOUT_MINUTES;
    expect(loadIdleTimeoutMinutes()).toBe(30);
  });

  it("returns the parsed integer when set to a valid value", () => {
    process.env.ADMIN_IDLE_TIMEOUT_MINUTES = "45";
    expect(loadIdleTimeoutMinutes()).toBe(45);
  });

  it("clamps below 5 up to 5", () => {
    process.env.ADMIN_IDLE_TIMEOUT_MINUTES = "1";
    expect(loadIdleTimeoutMinutes()).toBe(5);
  });

  it("clamps above 480 down to 480", () => {
    process.env.ADMIN_IDLE_TIMEOUT_MINUTES = "9999";
    expect(loadIdleTimeoutMinutes()).toBe(480);
  });

  it("falls back to 30 when value is not a number", () => {
    process.env.ADMIN_IDLE_TIMEOUT_MINUTES = "thirty";
    expect(loadIdleTimeoutMinutes()).toBe(30);
  });
});
