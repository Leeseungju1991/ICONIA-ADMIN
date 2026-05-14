import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadEnv, loadIconiaEnv } from "./env";

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

describe("loadIconiaEnv", () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    original = { ...process.env };
  });

  afterEach(() => {
    process.env = original;
  });

  it("returns explicit ICONIA_ENV when valid", () => {
    process.env.ICONIA_ENV = "staging";
    expect(loadIconiaEnv()).toBe("staging");
  });

  it("accepts production / staging / development", () => {
    process.env.ICONIA_ENV = "production";
    expect(loadIconiaEnv()).toBe("production");
    process.env.ICONIA_ENV = "development";
    expect(loadIconiaEnv()).toBe("development");
  });

  it("throws when ICONIA_ENV is not in the allowed enum", () => {
    process.env.ICONIA_ENV = "prod";
    expect(() => loadIconiaEnv()).toThrow(/ICONIA_ENV/);
  });

  it("falls back to production when ICONIA_ENV missing and NODE_ENV=production", () => {
    delete process.env.ICONIA_ENV;
    setNodeEnv("production");
    expect(loadIconiaEnv()).toBe("production");
  });

  it("falls back to development when ICONIA_ENV missing and NODE_ENV != production", () => {
    delete process.env.ICONIA_ENV;
    setNodeEnv("development");
    expect(loadIconiaEnv()).toBe("development");
  });
});
