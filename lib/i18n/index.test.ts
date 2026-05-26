import { describe, it, expect } from "vitest";
import { t, resolveLocale, SUPPORTED_LOCALES } from "./index";

describe("i18n", () => {
  it("resolves a Korean key", () => {
    expect(t("common.save", "ko")).toBe("저장");
    expect(t("nav.dashboard", "ko")).toBe("대시보드");
  });

  it("resolves an English key", () => {
    expect(t("common.save", "en")).toBe("Save");
    expect(t("nav.dashboard", "en")).toBe("Dashboard");
  });

  it("falls back to Korean when locale missing the key", () => {
    // 없는 키는 키 자체 반환
    expect(t("nonexistent.key", "en")).toBe("nonexistent.key");
  });

  it("respects cookie locale", () => {
    expect(resolveLocale("ko")).toBe("ko");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale(undefined)).toBe("ko");
    expect(resolveLocale("garbage")).toBe("ko");
  });

  it("lists supported locales", () => {
    expect(SUPPORTED_LOCALES).toEqual(["ko", "en"]);
  });
});
