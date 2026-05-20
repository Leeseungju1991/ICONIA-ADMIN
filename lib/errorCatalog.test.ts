import { describe, it, expect } from "vitest";
import {
  allErrorCodes,
  CATEGORY_LABEL,
  lookupCanonical,
  lookupErrorCode,
  operatorLabelForCode,
  USER_VISIBILITY_CHIP,
  USER_VISIBILITY_LABEL,
  userVisibleShareOfCatalog,
  validateAliasUniqueness,
} from "./errorCatalog";

describe("errorCatalog", () => {
  it("returns operator-friendly label for known firmware code", () => {
    expect(operatorLabelForCode("OTA_DOWNLOAD_FAIL")).toContain("OTA");
  });

  it("returns operator-friendly label for known server code", () => {
    expect(operatorLabelForCode("GEMINI_RATE_LIMITED")).toContain("Gemini");
  });

  it("falls back to the code itself for unknown codes", () => {
    expect(operatorLabelForCode("ZZ_NEW_UNCATALOGED")).toBe("ZZ_NEW_UNCATALOGED");
  });

  it("lookupErrorCode returns default entry with unknown category for unknown codes", () => {
    const entry = lookupErrorCode("ZZ_FOO");
    expect(entry.category).toBe("unknown");
    expect(entry.retryable).toBe(false);
  });

  it("PANIC_RTC_GPIO is critical and non-retryable", () => {
    const entry = lookupErrorCode("PANIC_RTC_GPIO");
    expect(entry.retryable).toBe(false);
    expect(entry.category).toBe("hardware");
  });

  it("GEMINI_GATEWAY_TIMEOUT is retryable transient", () => {
    const entry = lookupErrorCode("GEMINI_GATEWAY_TIMEOUT");
    expect(entry.retryable).toBe(true);
    expect(entry.category).toBe("upstream");
  });

  it("allErrorCodes returns at least 10 catalog entries", () => {
    expect(allErrorCodes().length).toBeGreaterThanOrEqual(10);
  });

  it("every category has a Korean label", () => {
    for (const entry of allErrorCodes()) {
      expect(CATEGORY_LABEL[entry.category]).toBeTruthy();
    }
  });

  it("every entry declares a userVisibility value", () => {
    for (const entry of allErrorCodes()) {
      expect(["silent", "in-character", "visible"]).toContain(entry.userVisibility);
    }
  });

  it("user-visibility labels and chips are defined for all three values", () => {
    for (const v of ["silent", "in-character", "visible"] as const) {
      expect(USER_VISIBILITY_LABEL[v]).toBeTruthy();
      expect(USER_VISIBILITY_CHIP[v]).toMatch(/^chip /);
    }
  });

  it("unknown code falls back to userVisibility=visible (conservative)", () => {
    const entry = lookupErrorCode("ZZ_NEW_UNCATALOGED");
    expect(entry.userVisibility).toBe("visible");
  });

  it("OTA_DOWNLOAD_FAIL is silent (background) and BLE_GATT_TIMEOUT is visible (pairing screen)", () => {
    expect(lookupErrorCode("OTA_DOWNLOAD_FAIL").userVisibility).toBe("silent");
    expect(lookupErrorCode("BLE_GATT_TIMEOUT").userVisibility).toBe("visible");
  });

  it("GEMINI timeouts are wrapped in-character to hide chat failures", () => {
    expect(lookupErrorCode("GEMINI_GATEWAY_TIMEOUT").userVisibility).toBe("in-character");
    expect(lookupErrorCode("GEMINI_RATE_LIMITED").userVisibility).toBe("in-character");
  });

  it("userVisibleShareOfCatalog returns a fraction in (0, 1)", () => {
    const share = userVisibleShareOfCatalog();
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(1);
  });
});

// Server canonical(`error-codes.md` ~120 ERR_*) ↔ Admin catalog 매핑 정합.
// 본 라운드 (2026-05-20) — Admin 카탈로그의 `serverAliases` 필드로 묶음 정의.
describe("errorCatalog server canonical alias", () => {
  it("lookupCanonical maps ERR_LLM_TIMEOUT to GEMINI_GATEWAY_TIMEOUT", () => {
    expect(lookupCanonical("ERR_LLM_TIMEOUT")).toBe("GEMINI_GATEWAY_TIMEOUT");
  });

  it("lookupCanonical maps ERR_RATE_LIMIT and ERR_QUOTA_EXCEEDED to GEMINI_RATE_LIMITED", () => {
    expect(lookupCanonical("ERR_RATE_LIMIT")).toBe("GEMINI_RATE_LIMITED");
    expect(lookupCanonical("ERR_QUOTA_EXCEEDED")).toBe("GEMINI_RATE_LIMITED");
  });

  it("lookupCanonical maps Woo upstream codes to WOO_BAD_GATEWAY", () => {
    for (const code of ["ERR_WC_HTTP", "ERR_WC_NETWORK", "ERR_WC_TIMEOUT", "ERR_WC_UNAVAILABLE"]) {
      expect(lookupCanonical(code)).toBe("WOO_BAD_GATEWAY");
    }
  });

  it("lookupCanonical maps ERR_DB_UNAVAILABLE to PG_POOL_EXHAUSTED", () => {
    expect(lookupCanonical("ERR_DB_UNAVAILABLE")).toBe("PG_POOL_EXHAUSTED");
  });

  it("lookupCanonical returns null for unmapped Server code", () => {
    expect(lookupCanonical("ERR_NOWHERE_DEFINED")).toBeNull();
    expect(lookupCanonical("")).toBeNull();
  });

  it("lookupErrorCode walks the alias chain for Server canonical codes", () => {
    const entry = lookupErrorCode("ERR_LLM_TIMEOUT");
    expect(entry.label).toContain("Gemini");
    expect(entry.category).toBe("upstream");
    expect(entry.retryable).toBe(true);
  });

  it("operatorLabelForCode resolves Server canonical via alias", () => {
    expect(operatorLabelForCode("ERR_LLM_TIMEOUT")).toContain("Gemini");
    expect(operatorLabelForCode("ERR_WC_TIMEOUT")).toContain("Woo");
  });

  it("operatorLabelForCode falls back to code when neither Admin nor Server alias exists", () => {
    expect(operatorLabelForCode("ERR_NOT_A_CATALOG_ENTRY")).toBe("ERR_NOT_A_CATALOG_ENTRY");
  });

  it("Admin catalog server aliases are unique (no Server code mapped to two Admin codes)", () => {
    const conflicts = validateAliasUniqueness();
    expect(conflicts).toEqual([]);
  });

  it("Admin catalog covers Server LLM/Woo/DB groups at minimum", () => {
    // 정합성 가드: 핵심 Server 묶음이 매핑 안 되면 admin 페이지에서 코드 그대로 노출.
    expect(lookupCanonical("ERR_LLM_TIMEOUT")).not.toBeNull();
    expect(lookupCanonical("ERR_DB_UNAVAILABLE")).not.toBeNull();
    expect(lookupCanonical("ERR_WC_HTTP")).not.toBeNull();
    expect(lookupCanonical("ERR_RATE_LIMIT")).not.toBeNull();
  });

  it("userVisibility is preserved when accessed via alias", () => {
    // ERR_RATE_LIMIT 은 GEMINI_RATE_LIMITED (in-character) 와 같은 정책을 노출해야 함.
    expect(lookupErrorCode("ERR_RATE_LIMIT").userVisibility).toBe("in-character");
    // ERR_WC_HTTP 는 WOO_BAD_GATEWAY (visible) 와 같은 정책.
    expect(lookupErrorCode("ERR_WC_HTTP").userVisibility).toBe("visible");
  });
});
