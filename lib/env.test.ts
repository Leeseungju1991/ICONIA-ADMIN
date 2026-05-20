import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadEnv,
  loadIconiaEnv,
  loadIdleTimeoutMinutes,
  loadDeployTarget,
} from "./env";

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

  it("throws when ICONIA_SERVER_URL is not http(s)", () => {
    process.env.ICONIA_SERVER_URL = "ftp://example.com";
    expect(() => loadEnv()).toThrow(/ICONIA_SERVER_URL/);
  });

  it("COOKIE_SECURE=true when NODE_ENV=production", () => {
    process.env.ICONIA_SERVER_URL = "https://api.example.com";
    setNodeEnv("production");
    expect(loadEnv().COOKIE_SECURE).toBe(true);
  });

  it("COOKIE_SECURE=false when NODE_ENV is not production and target=local", () => {
    process.env.ICONIA_SERVER_URL = "https://api.example.com";
    process.env.DEPLOY_TARGET = "local";
    setNodeEnv("development");
    expect(loadEnv().COOKIE_SECURE).toBe(false);
  });
});

describe("DEPLOY_TARGET — localhost ↔ AWS 단일 토글", () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    original = { ...process.env };
  });

  afterEach(() => {
    process.env = original;
  });

  it("defaults to local when DEPLOY_TARGET is unset", () => {
    delete process.env.DEPLOY_TARGET;
    expect(loadDeployTarget()).toBe("local");
  });

  it("accepts local / aws (case-insensitive)", () => {
    process.env.DEPLOY_TARGET = "AWS";
    expect(loadDeployTarget()).toBe("aws");
    process.env.DEPLOY_TARGET = "local";
    expect(loadDeployTarget()).toBe("local");
  });

  it("throws when DEPLOY_TARGET is an unknown value", () => {
    process.env.DEPLOY_TARGET = "staging";
    expect(() => loadDeployTarget()).toThrow(/DEPLOY_TARGET/);
  });

  it("local toggle: ICONIA_SERVER_URL defaults to localhost:8080", () => {
    process.env.DEPLOY_TARGET = "local";
    delete process.env.ICONIA_SERVER_URL;
    delete process.env.ICONIA_ENV;
    setNodeEnv("development");
    const env = loadEnv();
    expect(env.ICONIA_SERVER_URL).toBe("http://localhost:8080");
    expect(env.ICONIA_ENV).toBe("development");
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.DEPLOY_TARGET).toBe("local");
  });

  it("aws toggle: ICONIA_ENV=production + COOKIE_SECURE=true from preset", () => {
    process.env.DEPLOY_TARGET = "aws";
    process.env.ICONIA_SERVER_URL = "https://api.iconia.example.com";
    delete process.env.ICONIA_ENV;
    setNodeEnv("development");
    const env = loadEnv();
    expect(env.ICONIA_ENV).toBe("production");
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.DEPLOY_TARGET).toBe("aws");
  });

  it("aws toggle throws when ICONIA_SERVER_URL override is missing", () => {
    process.env.DEPLOY_TARGET = "aws";
    delete process.env.ICONIA_SERVER_URL;
    expect(() => loadEnv()).toThrow(/ICONIA_SERVER_URL is required/);
  });

  it("aws toggle rejects a plain-http Server URL", () => {
    process.env.DEPLOY_TARGET = "aws";
    process.env.ICONIA_SERVER_URL = "http://api.iconia.example.com";
    expect(() => loadEnv()).toThrow(/aws requires an https/);
  });

  it("explicit ICONIA_SERVER_URL overrides the toggle preset", () => {
    process.env.DEPLOY_TARGET = "local";
    process.env.ICONIA_SERVER_URL = "http://127.0.0.1:9090";
    expect(loadEnv().ICONIA_SERVER_URL).toBe("http://127.0.0.1:9090");
  });
});

describe("loadIconiaEnv + loadIdleTimeoutMinutes", () => {
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

  it("falls back to production when ICONIA_ENV missing and DEPLOY_TARGET=aws", () => {
    delete process.env.ICONIA_ENV;
    process.env.DEPLOY_TARGET = "aws";
    expect(loadIconiaEnv()).toBe("production");
  });

  it("falls back to development when ICONIA_ENV missing and DEPLOY_TARGET=local", () => {
    delete process.env.ICONIA_ENV;
    process.env.DEPLOY_TARGET = "local";
    expect(loadIconiaEnv()).toBe("development");
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
