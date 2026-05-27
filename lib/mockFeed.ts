export type FeedListItem = {
  id: string;
  author_id: string;
  author_name: string;
  excerpt: string;
  media_thumb: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  report_count: number;
  status: "visible" | "hidden" | "taken_down";
};

export type FeedComment = {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  status: "visible" | "hidden";
};

export type FeedReport = {
  reporter_id: string;
  reporter_name: string;
  reason: string;
  created_at: string;
};

export type FeedPost = FeedListItem & {
  body: string;
  media: string[];
  comments: FeedComment[];
  reports: FeedReport[];
};

export type CommunityHealth = {
  posts_24h: number;
  active_authors_dau: number;
  reports_pending: number;
  takedowns_7d: number;
};

const TITLES = [
  "오늘 인형이 처음으로 농담을 했어요 진짜 웃겼음",
  "배터리 갈았는데도 8시간 지나면 빠지는 거 정상인가요?",
  "Aria 페르소나로 바꿨더니 말투가 너무 귀여워요…",
  "OTA 업데이트 후 응답 속도 체감 빨라짐",
  "오프라인 모드에서 부분 응답이라도 가능했으면",
  "공식 케이스 색상 더 다양했으면 좋겠어요",
  "친구한테 보여줬더니 자기도 사고 싶다고",
  "AS 신청했는데 진행 상태 알림 좀 자세히 주세요",
  "감정 온도 게이지 너무 자주 떨어져요",
  "야간 사용 시 LED 좀 더 어둡게",
];

const AUTHORS = ["루나", "민지", "Kai", "은하", "선우", "Rio", "지안", "Noa"];

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildItems(count: number): FeedListItem[] {
  const rnd = mulberry32(7);
  const out: FeedListItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const reports = Math.floor(rnd() * 5);
    out.push({
      id: `post_${i.toString().padStart(4, "0")}`,
      author_id: `usr_${Math.floor(rnd() * 9999)}`,
      author_name: AUTHORS[Math.floor(rnd() * AUTHORS.length)],
      excerpt: TITLES[i % TITLES.length],
      media_thumb: rnd() > 0.5 ? `https://picsum.photos/seed/${i}/240/160` : null,
      created_at: new Date(Date.now() - i * 1_800_000).toISOString(),
      like_count: Math.floor(rnd() * 500),
      comment_count: Math.floor(rnd() * 80),
      report_count: reports,
      status: reports >= 4 ? "taken_down" : reports >= 2 && rnd() > 0.5 ? "hidden" : "visible",
    });
  }
  return out;
}

const ALL = buildItems(48);

export function mockFeedList(tab: "latest" | "popular" | "reported"): { items: FeedListItem[]; next_cursor: string | null } {
  let items = [...ALL];
  if (tab === "reported") items = items.filter((p) => p.report_count > 0);
  if (tab === "popular") items = items.sort((a, b) => b.like_count - a.like_count);
  if (tab === "latest") items = items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return { items: items.slice(0, 24), next_cursor: items.length > 24 ? `cur_${items.length}` : null };
}

export function mockFeedPost(id: string): FeedPost {
  const base = ALL.find((p) => p.id === id) ?? ALL[0];
  const rnd = mulberry32(base.id.length);
  const comments: FeedComment[] = Array.from({ length: Math.min(base.comment_count, 20) }, (_, i) => ({
    id: `cmt_${base.id}_${i}`,
    author_id: `usr_${Math.floor(rnd() * 9999)}`,
    author_name: AUTHORS[Math.floor(rnd() * AUTHORS.length)],
    body: ["완전 공감", "ㅠㅠ 저도요", "버전 정보 알려주세요", "ㅋㅋㅋㅋ"][i % 4],
    created_at: new Date(Date.now() - i * 600_000).toISOString(),
    status: i === 3 ? "hidden" : "visible",
  }));
  const reports: FeedReport[] = Array.from({ length: base.report_count }, (_, i) => ({
    reporter_id: `usr_${Math.floor(rnd() * 9999)}`,
    reporter_name: AUTHORS[Math.floor(rnd() * AUTHORS.length)],
    reason: ["spam", "abusive", "harmful", "other"][i % 4],
    created_at: new Date(Date.now() - i * 7_200_000).toISOString(),
  }));
  return {
    ...base,
    body: `${base.excerpt}\n\n본문 내용입니다. 사용자가 작성한 긴 글의 시뮬레이션 본문이며 모더레이션 인스펙터에서 전체가 표시됩니다.`,
    media: base.media_thumb ? [base.media_thumb] : [],
    comments,
    reports,
  };
}

export function mockCommunityHealth(): CommunityHealth {
  return {
    posts_24h: 312,
    active_authors_dau: 184,
    reports_pending: ALL.filter((p) => p.report_count > 0 && p.status === "visible").length,
    takedowns_7d: ALL.filter((p) => p.status === "taken_down").length,
  };
}
