import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadEnv, loadIconiaEnv, loadIdleTimeoutMinutes } from "./env";

// AWS 실서버 정본 ALB URL — env override 가 없을 때의 단일 데이터 대상.
// 2026-06-25: AWS 계정 이전(022671037305 → 169063643478) 후 ALB URL 변경.
const AWS_SERVER_URL =
  "http://iconia-prod-alb-1408962743.ap-northeast-2.elb.amazonaws.com";

function setNodeEnv(v: string) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = v;
}

describe("loadEnv — AWS 실서버 단일 연결", () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    original = { ...process.env };
  });

  afterEach(() => {
    process.env = original;
  });

  it("defaults ICONIA_SERVER_URL to the AWS ALB when unset", () => {
    delete process.env.ICONIA_SERVER_URL;
    expect(loadEnv().ICONIA_SERVER_URL).toBe(AWS_SERVER_URL);
  });

  it("env override wins over the AWS default", () => {
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

  it("COOKIE_SECURE defaults to true", () => {
    delete process.env.COOKIE_SECURE_OVERRIDE;
    expect(loadEnv().COOKIE_SECURE).toBe(true);
  });

  it("COOKIE_SECURE=false only when COOKIE_SECURE_OVERRIDE=false", () => {
    process.env.COOKIE_SECURE_OVERRIDE = "false";
    expect(loadEnv().COOKIE_SECURE).toBe(false);
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

  it("defaults to production when ICONIA_ENV is unset", () => {
    delete process.env.ICONIA_ENV;
    expect(loadIconiaEnv()).toBe("production");
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
