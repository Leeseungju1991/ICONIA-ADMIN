import FaqsClient from "./FaqsClient";

// 2026-06-01 — FAQ 관리 페이지. Server: /api/v1/admin/info/faqs (CS_OR_ABOVE).
// 인증 게이트는 dashboard/layout.tsx + middleware 가 처리.
export const dynamic = "force-dynamic";

export default function FaqsPage() {
  return <FaqsClient />;
}
