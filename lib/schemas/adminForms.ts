// Phase D wiring — zod schemas for admin CRUD forms.
//
// Server Phase B 가 추가 중인 admin endpoint 의 body 필드 정합:
//   PATCH /api/v1/admin/feed/posts/:id  body { status?, visibility?, moderation_note?, body?, is_hidden? }
//   POST  /api/v1/admin/commerce/products body { name, price, stock?, stock_status?, ... }
//   PATCH /api/v1/admin/commerce/products/:id body partial of above
//
// 본 모듈은 client-side 검증 + 서버 검증 메시지 통합 진입점. server action 들도
// 동일 schema 로 입력 정합을 보장한다 (lib/actions/feed.ts, commerceAdmin.ts).
//
// 양쪽 스펙(현 page-based form + 새 Phase B 스펙) 을 모두 수용하기 위해 신규 필드는
// 전부 optional. 기존 form 은 그대로 통과한다.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Feed post moderation — PATCH body.
// ---------------------------------------------------------------------------

/**
 * Server 가 정의한 게시물 가시성 상태. legacy `is_hidden` 과 병존.
 *
 * Server 정합: `2. SERVER/src/routes/adminFeedCommerceRoutes.js:48` 의
 * `feedPostPatchSchema` 는 `"published" | "hidden" | "removed"` 만 수용한다.
 * UI 표시 라벨은 `feedPostStatusLabel` 헬퍼로 한국어 "공개/숨김/삭제" 매핑.
 */
export const feedPostStatusSchema = z.enum(["published", "hidden", "removed"]);
export type FeedPostStatus = z.infer<typeof feedPostStatusSchema>;

/** UI 표시용 한국어 라벨. server enum → 한글. */
export const feedPostStatusLabel: Record<FeedPostStatus, string> = {
  published: "공개",
  hidden: "숨김",
  removed: "삭제",
};

/** Server 가 정의한 노출 범위. */
export const feedPostVisibilitySchema = z.enum(["public", "followers", "private"]);
export type FeedPostVisibility = z.infer<typeof feedPostVisibilitySchema>;

/**
 * Admin 이 PATCH /api/v1/admin/feed/posts/:id 로 보낼 수 있는 모든 필드.
 * 모두 optional — 적어도 한 필드는 있어야 한다는 refinement.
 */
export const patchFeedPostSchema = z
  .object({
    body: z.string().min(1).max(8000).optional(),
    is_hidden: z.boolean().optional(),
    status: feedPostStatusSchema.optional(),
    visibility: feedPostVisibilitySchema.optional(),
    moderation_note: z.string().max(1000).optional(),
    // 2026-06-13 (사용자 요청 #9) — 위치(쉼표 구분) / 해시태그 관리.
    location: z.string().max(200).nullable().optional(),
    hashtags: z.array(z.string().min(1).max(80)).max(10).optional(),
  })
  .refine(
    (v) =>
      v.body !== undefined ||
      v.is_hidden !== undefined ||
      v.status !== undefined ||
      v.visibility !== undefined ||
      v.moderation_note !== undefined ||
      v.location !== undefined ||
      v.hashtags !== undefined,
    { message: "최소 한 개의 필드를 수정하세요." },
  );

export type PatchFeedPostInput = z.infer<typeof patchFeedPostSchema>;

// ---------------------------------------------------------------------------
// Commerce product — POST/PATCH body.
// ---------------------------------------------------------------------------

/** WooCommerce 호환 재고 상태 토큰. */
export const productStockStatusSchema = z.enum([
  "instock",
  "outofstock",
  "onbackorder",
]);
export type ProductStockStatus = z.infer<typeof productStockStatusSchema>;

/**
 * POST /api/v1/admin/commerce/products body.
 * 가격은 KRW 기준 정수, 음수 금지. 재고는 수량 + 토큰 둘 다 optional 이지만
 * 둘 다 비어 있으면 거부 (서버가 기본값을 추정할 수 없음).
 */
export const createProductSchema = z
  .object({
    name: z.string().trim().min(2, "상품명은 2자 이상.").max(200),
    description: z.string().max(8000).optional(),
    price: z
      .number({ invalid_type_error: "가격은 숫자." })
      .int("가격은 정수.")
      .min(0, "가격은 0 이상."),
    currency: z.string().length(3).optional(),
    category: z.string().trim().max(80).optional(),
    image_url: z
      .string()
      .trim()
      .url("이미지 URL 형식 오류.")
      .max(2048)
      .optional()
      .or(z.literal("")),
    stock: z
      .number()
      .int("재고는 정수.")
      .min(0, "재고는 0 이상.")
      .optional(),
    stock_status: productStockStatusSchema.optional(),
  })
  .refine((v) => v.stock !== undefined || v.stock_status !== undefined, {
    message: "재고 수량 또는 재고 상태 중 한 개는 입력해야 합니다.",
    path: ["stock"],
  });

export type CreateProductFormInput = z.infer<typeof createProductSchema>;

/** PATCH body — 모든 필드 partial. */
export const updateProductSchema = createProductSchema
  .innerType()
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "최소 한 개의 필드를 수정하세요.",
  });

export type UpdateProductFormInput = z.infer<typeof updateProductSchema>;

// ---------------------------------------------------------------------------
// 공통 — server 에러 정규화 헬퍼.
// ---------------------------------------------------------------------------

/**
 * zod safeParse 실패 시 사용자에게 보여줄 1줄 메시지로 변환.
 * 첫 번째 issue 의 path + message 만 노출 — 폼 옆에 inline 으로 표시.
 */
export function firstZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "입력값 오류.";
  if (issue.path.length === 0) return issue.message;
  return `${issue.path.join(".")} — ${issue.message}`;
}
