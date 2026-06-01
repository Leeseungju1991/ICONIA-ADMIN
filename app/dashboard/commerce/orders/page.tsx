import OrdersClient from "./OrdersClient";

// 2026-06-01 — 커머스 주문 페이지 (DISPLAY-ONLY).
// CLAUDE.md §2: 결제·주문·환불·장바구니·배송 mutation 비구현.
// 본 페이지는 list + 상세 모달만. 결제/환불 버튼 절대 추가 금지.
export const dynamic = "force-dynamic";

export default function OrdersPage() {
  return <OrdersClient />;
}
