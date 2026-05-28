# ICONIA Contract Matrix (ADMIN 측 요약)

**라운드:** 2026-05-28 contract 정합 round
**정본 정책:** SERVER 가 single source of truth. ADMIN 은 SERVER endpoint spec 에 맞춤.
**전체 매트릭스:** `ICONIA-SERVER/docs/contract-matrix.md` (정본 위치)

## ADMIN 가 호출하는 SERVER endpoint (요약)

전부 `lib/adminApi.ts` 에서 `authedRequest` (httpOnly cookie 의 JWT 를 Bearer 로) 송신. server actions (`lib/actions/*.ts`) 는 본 wrapper 를 다시 호출.

주요 그룹:
- 사용자 관리: `/api/v1/admin/users{,/:id,/:id/{force-logout,pause,resume,mfa-reset,pipa/*},/rights}`
- 디바이스 / 펌웨어: `/api/v1/admin/{devices,firmware,...}`
- 피드 운영: `/api/v1/admin/feed/posts{,/:id}` — list/get/create/patch/delete
- 커머스 운영: `/api/v1/admin/{commerce/orders,commerce/banners,commerce/webhooks}`
- 운영 인사이트: `/api/v1/admin/{ai-health,errors/*,gemini/*,trace,alerts,reports,cost}`
- 정보 콘텐츠: `/api/v1/admin/{info/faqs,notices,personas,pipa,production,rag/*,push/campaigns}`
- 미디어: `/api/v1/admin/media/upload` (multipart)

## 본 라운드 변경
- `AdminCreateUserInput.role` type 을 `"user"` 로 좁힘 (SERVER zod enum 정합).
- 기존 `createAdminUser` / `createAdminFeedPost` / `patchAdminFeedPost` / `listAdminFeedPosts` wrapper 는 그대로. SERVER 측이 alias 필드 (`body`/`is_hidden`/`moderation_note`, `q`/`hidden`/`page`/`page_size`/`from`/`to`) 를 수용하도록 schema/handler 확장됨.

## 회귀 가드
- `lib/adminApi.contractAlignment.test.ts` (10 cases)

자세한 정합 상태·error code·envelope 정본은 SERVER 측 contract-matrix.md 참조.
