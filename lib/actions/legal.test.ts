import { describe, it, expect, beforeEach, vi } from "vitest";

// Cookie stub — readSession() 이 next/headers.cookies().get() 호출.
const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("@/lib/adminApi", () => ({
  getActiveTermsVersions: vi.fn(),
  listTermsVersions: vi.fn(),
  publishTermsVersion: vi.fn(),
  getConsentStats: vi.fn(),
  getBusinessInfo: vi.fn(),
}));

import {
  getActiveTermsVersions,
  listTermsVersions,
  publishTermsVersion,
  getConsentStats,
  getBusinessInfo,
} from "@/lib/adminApi";
import {
  getActiveTermsAction,
  listTermsAction,
  publishTermsAction,
  getConsentStatsAction,
  getBusinessInfoAction,
} from "./legal";

const mActive = getActiveTermsVersions as unknown as ReturnType<typeof vi.fn>;
const mList = listTermsVersions as unknown as ReturnType<typeof vi.fn>;
const mPublish = publishTermsVersion as unknown as ReturnType<typeof vi.fn>;
const mStats = getConsentStats as unknown as ReturnType<typeof vi.fn>;
const mBiz = getBusinessInfo as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mActive.mockReset();
  mList.mockReset();
  mPublish.mockReset();
  mStats.mockReset();
  mBiz.mockReset();
});

describe("getActiveTermsAction", () => {
  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await getActiveTermsAction();
    expect(r.ok).toBe(false);
    expect(mActive).not.toHaveBeenCalled();
  });

  it("passes through Server data", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-x" });
    mActive.mockResolvedValue({
      ok: true,
      data: { terms_version: "v2.0", privacy_version: "v2.0" },
    });
    const r = await getActiveTermsAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.terms_version).toBe("v2.0");
  });
});

describe("listTermsAction graceful fallback", () => {
  beforeEach(() => {
    cookieStore.get.mockReturnValue({ value: "jwt-x" });
  });

  it("returns placeholder=false when Server returns items", async () => {
    mList.mockResolvedValue({ ok: true, data: { items: [{ kind: "terms", version: "v1.0" }] } });
    const r = await listTermsAction();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.placeholder).toBe(false);
      expect(r.data.items.length).toBe(1);
    }
  });

  it("returns placeholder=true when Server returns ERR_NETWORK", async () => {
    mList.mockResolvedValue({ ok: false, code: "ERR_NETWORK", message: "x", status: 0 });
    const r = await listTermsAction();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.placeholder).toBe(true);
      // 4종 약관이 모두 포함되어야 한다 (terms/privacy/marketing/third_party).
      expect(r.data.items.length).toBe(4);
      const kinds = r.data.items.map((i) => i.kind).sort();
      expect(kinds).toEqual(["marketing", "privacy", "terms", "third_party"]);
    }
  });

  it("returns placeholder=true on 404", async () => {
    mList.mockResolvedValue({ ok: false, code: "ERR_NOT_FOUND", message: "x", status: 404 });
    const r = await listTermsAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.placeholder).toBe(true);
  });

  it("returns error for real server errors (5xx)", async () => {
    mList.mockResolvedValue({ ok: false, code: "ERR_SERVER_UNAVAILABLE", message: "down", status: 503 });
    const r = await listTermsAction();
    expect(r.ok).toBe(false);
  });

  it("filters by kind when provided", async () => {
    mList.mockResolvedValue({ ok: false, code: "ERR_NETWORK", message: "x", status: 0 });
    const r = await listTermsAction({ kind: "privacy" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.items.every((i) => i.kind === "privacy")).toBe(true);
    }
  });
});

describe("publishTermsAction validation", () => {
  beforeEach(() => {
    cookieStore.get.mockReturnValue({ value: "jwt-x" });
  });

  it("rejects empty version", async () => {
    const r = await publishTermsAction({
      kind: "terms",
      version: "  ",
      body_ko: "a".repeat(30),
      change_note: "valid reason",
      activate: false,
    });
    expect(r.ok).toBe(false);
    expect(mPublish).not.toHaveBeenCalled();
  });

  it("rejects body < 20 chars", async () => {
    const r = await publishTermsAction({
      kind: "terms",
      version: "v1.1",
      body_ko: "short",
      change_note: "valid reason",
      activate: false,
    });
    expect(r.ok).toBe(false);
    expect(mPublish).not.toHaveBeenCalled();
  });

  it("rejects change_note < 5 chars", async () => {
    const r = await publishTermsAction({
      kind: "terms",
      version: "v1.1",
      body_ko: "a".repeat(30),
      change_note: "x",
      activate: false,
    });
    expect(r.ok).toBe(false);
    expect(mPublish).not.toHaveBeenCalled();
  });

  it("forwards valid payload to Server with trimmed values", async () => {
    mPublish.mockResolvedValue({ ok: true, data: { kind: "terms", version: "v1.1" } });
    const r = await publishTermsAction({
      kind: "terms",
      version: "  v1.1  ",
      body_ko: "a".repeat(30),
      change_note: "  valid reason  ",
      activate: true,
    });
    expect(r.ok).toBe(true);
    expect(mPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "terms",
        version: "v1.1",
        change_note: "valid reason",
        activate: true,
      }),
    );
  });
});

describe("getConsentStatsAction graceful fallback", () => {
  beforeEach(() => {
    cookieStore.get.mockReturnValue({ value: "jwt-x" });
  });

  it("returns placeholder on ERR_NETWORK", async () => {
    mStats.mockResolvedValue({ ok: false, code: "ERR_NETWORK", message: "x", status: 0 });
    const r = await getConsentStatsAction({ days: 30 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.placeholder).toBe(true);
      expect(r.data.stats.total_consent_events).toBeGreaterThan(0);
    }
  });
});

describe("getBusinessInfoAction", () => {
  it("returns placeholder when no session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await getBusinessInfoAction();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.placeholder).toBe(true);
      expect(r.data.company_name_ko).toContain("숨코리아");
    }
  });

  it("returns placeholder when Server fails", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-x" });
    mBiz.mockResolvedValue({ ok: false, code: "ERR_NETWORK", message: "x", status: 0 });
    const r = await getBusinessInfoAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.placeholder).toBe(true);
  });

  it("returns Server data with placeholder=false when reachable", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-x" });
    mBiz.mockResolvedValue({
      ok: true,
      data: {
        company_name_ko: "(주)숨코리아",
        company_name_en: "Soom Korea Inc.",
        ceo: "홍길동",
        business_registration_no: "123-45-67890",
        ecommerce_registration_no: "제2026-서울강남-0001호",
        address_ko: "서울특별시 강남구",
        address_en: "Gangnam, Seoul",
        phone: "02-0000-0000",
        support_email: "support@soomkorea.com",
        privacy_officer: "김개인",
        privacy_officer_email: "privacy@soomkorea.com",
      },
    });
    const r = await getBusinessInfoAction();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.placeholder).toBe(false);
      expect(r.data.ceo).toBe("홍길동");
    }
  });
});
