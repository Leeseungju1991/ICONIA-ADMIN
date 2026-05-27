"use client";

// 공지·푸시 통합 페이지.
// 기존 /dashboard/notices + /dashboard/push 컴포넌트를 한 화면에 스택.

import NoticesPage from "../notices/page";
import PushPage from "../push/page";

export default function NoticePushPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">공지·배너</h2>
        <NoticesPage />
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">푸시 알림</h2>
        <PushPage />
      </section>
    </div>
  );
}
