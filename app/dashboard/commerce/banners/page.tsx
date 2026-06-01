import BannersClient from "./BannersClient";

// 2026-06-01 — 커머스 배너 관리 페이지.
// Server: /api/v1/admin/commerce/banners (CS_OR_ABOVE).
export const dynamic = "force-dynamic";

export default function BannersPage() {
  return <BannersClient />;
}
