// Dev-only fixture — `/api/admin/reports?status=open` 빈 응답 fallback.

import type { ReportRow } from "@/types/admin-api";

export const fixtureReports: ReportRow[] = [
  {
    id: "rp_001",
    target_kind: "post",
    target_id: "post_98123",
    target_excerpt: "(욕설 포함 게시물 발췌 — 일부 마스킹됨)",
    reason: "욕설/비방",
    reported_count: 12,
    status: "open",
    last_reported_at: new Date(Date.now() - 4 * 60_000).toISOString(),
    in_progress_by: null,
  },
  {
    id: "rp_002",
    target_kind: "comment",
    target_id: "cmt_55102",
    target_excerpt: "타인 도용 의심 댓글.",
    reason: "스팸/도용",
    reported_count: 3,
    status: "open",
    last_reported_at: new Date(Date.now() - 32 * 60_000).toISOString(),
    in_progress_by: null,
  },
  {
    id: "rp_003",
    target_kind: "user",
    target_id: "usr_4421",
    target_excerpt: null,
    reason: "혐오 표현 반복",
    reported_count: 7,
    status: "open",
    last_reported_at: new Date(Date.now() - 90 * 60_000).toISOString(),
    in_progress_by: "operator@iconia.example",
  },
];
