import { describe, it, expect } from "vitest";
import {
  mockFeedList,
  mockFeedPost,
  mockCommunityHealth,
  type FeedPost,
} from "./mockFeed";

describe("mockFeed", () => {
  it("list returns >= 20 items", () => {
    const out = mockFeedList("latest");
    expect(out.items.length).toBeGreaterThanOrEqual(20);
  });
  it("reported tab has only items with report_count > 0", () => {
    const out = mockFeedList("reported");
    for (const p of out.items) expect(p.report_count).toBeGreaterThan(0);
  });
  it("popular tab is sorted by like_count desc", () => {
    const out = mockFeedList("popular");
    for (let i = 1; i < out.items.length; i += 1) {
      expect(out.items[i - 1].like_count >= out.items[i].like_count).toBe(true);
    }
  });
  it("post detail includes comments + reports", () => {
    const list = mockFeedList("latest");
    const post: FeedPost = mockFeedPost(list.items[0].id);
    expect(post.body.length).toBeGreaterThan(0);
    expect(Array.isArray(post.comments)).toBe(true);
    expect(Array.isArray(post.reports)).toBe(true);
  });
  it("health returns 4 KPI fields", () => {
    const h = mockCommunityHealth();
    expect(typeof h.posts_24h).toBe("number");
    expect(typeof h.active_authors_dau).toBe("number");
    expect(typeof h.reports_pending).toBe("number");
    expect(typeof h.takedowns_7d).toBe("number");
  });
});
