import type { CommunityHealth } from "@/lib/mockFeed";
import { KpiChip } from "./KpiChip";

export function CommunityHealthChips({ health }: { health: CommunityHealth }) {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiChip tone="indigo" icon="chat" label="24h 게시물" value={health.posts_24h.toLocaleString()} sub="post volume" />
      <KpiChip tone="teal" icon="device" label="활성 작성자(DAU)" value={health.active_authors_dau.toLocaleString()} sub="unique authors" />
      <KpiChip tone="orange" icon="alert" label="신고 대기" value={health.reports_pending.toLocaleString()} sub="visible + reported" />
      <KpiChip tone="pink" icon="queue" label="7일 takedown" value={health.takedowns_7d.toLocaleString()} sub="permanent" />
    </section>
  );
}
