import { describe, it, expect } from "vitest";
import {
  patchFeedPostSchema,
  createProductSchema,
  updateProductSchema,
  firstZodError,
} from "./adminForms";

describe("patchFeedPostSchema", () => {
  it("accepts a single legacy field (is_hidden)", () => {
    const r = patchFeedPostSchema.safeParse({ is_hidden: true });
    expect(r.success).toBe(true);
  });

  it("accepts new Phase-B fields (status/visibility/moderation_note)", () => {
    const r = patchFeedPostSchema.safeParse({
      status: "removed",
      visibility: "private",
      moderation_note: "abusive language reported by 3 users",
    });
    expect(r.success).toBe(true);
  });

  it("accepts all server status enum values (published/hidden/removed)", () => {
    for (const status of ["published", "hidden", "removed"] as const) {
      const r = patchFeedPostSchema.safeParse({ status });
      expect(r.success, `status=${status}`).toBe(true);
    }
  });

  it("rejects legacy mock tokens (visible/taken_down)", () => {
    expect(patchFeedPostSchema.safeParse({ status: "visible" }).success).toBe(false);
    expect(patchFeedPostSchema.safeParse({ status: "taken_down" }).success).toBe(false);
  });

  it("rejects empty body (must touch at least one field)", () => {
    const r = patchFeedPostSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects invalid status enum", () => {
    const r = patchFeedPostSchema.safeParse({ status: "deleted_forever" });
    expect(r.success).toBe(false);
  });

  it("rejects body longer than 8000 chars", () => {
    const r = patchFeedPostSchema.safeParse({ body: "x".repeat(8001) });
    expect(r.success).toBe(false);
  });
});

describe("createProductSchema", () => {
  it("accepts a minimal valid product (stock=0)", () => {
    const r = createProductSchema.safeParse({
      name: "SOUL Doll",
      price: 89000,
      stock: 0,
    });
    expect(r.success).toBe(true);
  });

  it("accepts stock_status without numeric stock", () => {
    const r = createProductSchema.safeParse({
      name: "SOUL Doll",
      price: 89000,
      stock_status: "instock",
    });
    expect(r.success).toBe(true);
  });

  it("rejects when neither stock nor stock_status provided", () => {
    const r = createProductSchema.safeParse({
      name: "SOUL Doll",
      price: 89000,
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative price", () => {
    const r = createProductSchema.safeParse({
      name: "SOUL Doll",
      price: -1,
      stock: 1,
    });
    expect(r.success).toBe(false);
  });

  it("rejects name shorter than 2 chars", () => {
    const r = createProductSchema.safeParse({
      name: "A",
      price: 100,
      stock: 1,
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-URL image_url", () => {
    const r = createProductSchema.safeParse({
      name: "SOUL Doll",
      price: 100,
      stock: 1,
      image_url: "not-a-url",
    });
    expect(r.success).toBe(false);
  });

  it("accepts empty image_url (treated as omitted)", () => {
    const r = createProductSchema.safeParse({
      name: "SOUL Doll",
      price: 100,
      stock: 1,
      image_url: "",
    });
    expect(r.success).toBe(true);
  });
});

describe("updateProductSchema", () => {
  it("accepts single-field patch", () => {
    const r = updateProductSchema.safeParse({ price: 99000 });
    expect(r.success).toBe(true);
  });

  it("rejects empty patch", () => {
    const r = updateProductSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects bad stock_status enum on patch", () => {
    const r = updateProductSchema.safeParse({ stock_status: "wat" as never });
    expect(r.success).toBe(false);
  });
});

describe("firstZodError", () => {
  it("returns first issue with path", () => {
    const r = createProductSchema.safeParse({
      name: "A",
      price: -1,
      stock: 1,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = firstZodError(r.error);
      expect(msg).toMatch(/name|상품명/);
    }
  });

  it("falls back to default when issues empty", () => {
    // Synthesize an empty ZodError to ensure path-less fallback works.
    const fakeErr = new (class extends Error {
      issues = [] as never[];
    })() as unknown as Parameters<typeof firstZodError>[0];
    expect(firstZodError(fakeErr)).toBe("입력값 오류.");
  });
});
