// contract alignment 라운드 (2026-05-28) — ADMIN ↔ SERVER 정합 보장.
//
// 본 테스트는 ADMIN lib/adminApi.ts 의 wrapper 가 SERVER zod schema 가 받아들이는
// 정확한 body / query 형태를 송신하는지 검증한다. SERVER 가 정본이므로 ADMIN 의
// 송신 모양이 변경되면 SERVER 와의 contract drift 가 발생.
//
// 검증 대상 endpoint:
//   - POST   /api/v1/admin/users         (createAdminUser)
//   - POST   /api/v1/admin/feed/posts    (createAdminFeedPost)
//   - PATCH  /api/v1/admin/feed/posts/:id (patchAdminFeedPost — alias body/is_hidden/moderation_note)
//   - GET    /api/v1/admin/feed/posts    (listAdminFeedPosts — alias q/hidden/from/to/page/page_size)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createAdminUser,
  createAdminFeedPost,
  patchAdminFeedPost,
  listAdminFeedPosts,
} from "./adminApi";

const BASE = "https://api.example.com";

beforeEach(() => {
  process.env.ICONIA_SERVER_URL = BASE;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(input: { status: number; body: unknown }) {
  const body = JSON.stringify(input.body);
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body, {
      status: input.status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("contract alignment — POST /api/v1/admin/users body shape", () => {
  it("role 미지정 시 'user' 기본값 (SERVER zod enum=['user'] 와 정합)", async () => {
    const fetchMock = mockFetchOnce({
      status: 201,
      body: { ok: true, data: { user: { id: "u", email: "a@b.c" } }, error: null },
    });
    await createAdminUser({
      jwt: "j",
      email: "a@b.c",
      password: "Strong#Pass1",
      agreedTermsVersion: "1.0",
      ageVerified: true,
      reason: "contract test reason",
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.role).toBe("user");
  });

  it("필수 필드 (email/password/agreedTermsVersion/ageVerified/reason) 전송", async () => {
    const fetchMock = mockFetchOnce({
      status: 201,
      body: { ok: true, data: { user: { id: "u", email: "a@b.c" } }, error: null },
    });
    await createAdminUser({
      jwt: "j",
      email: "a@b.c",
      password: "Strong#Pass1",
      agreedTermsVersion: "1.0",
      ageVerified: true,
      reason: "contract test reason",
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.email).toBe("a@b.c");
    expect(body.password).toBe("Strong#Pass1");
    expect(body.agreedTermsVersion).toBe("1.0");
    expect(body.ageVerified).toBe(true);
    expect(body.reason).toBe("contract test reason");
  });
});

describe("contract alignment — POST /api/v1/admin/feed/posts body shape", () => {
  it("authorId + body + reason 필수 + media 옵셔널 (SERVER feedPostCreateSchema 정합)", async () => {
    const fetchMock = mockFetchOnce({
      status: 201,
      body: { ok: true, data: { post: { id: "p" }, mediaCount: 1 }, error: null },
    });
    await createAdminFeedPost({
      jwt: "j",
      authorId: "00000000-0000-0000-0000-000000000001",
      body: "ADMIN proxy post content",
      reason: "사용자 가장 작성 — 영업 시연",
      media: [
        {
          url: "https://cdn.example/x.png",
          type: "image",
          width: 800,
          height: 600,
        },
      ],
      status: "published",
    });
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body as string);
    expect(sent.authorId).toBe("00000000-0000-0000-0000-000000000001");
    expect(sent.body).toBe("ADMIN proxy post content");
    expect(sent.reason).toBe("사용자 가장 작성 — 영업 시연");
    expect(Array.isArray(sent.media)).toBe(true);
    expect(sent.media[0].url).toBe("https://cdn.example/x.png");
    expect(sent.media[0].type).toBe("image");
    expect(sent.status).toBe("published");
  });
});

describe("contract alignment — PATCH /api/v1/admin/feed/posts/:id alias 필드", () => {
  it("`body` alias 송신 (SERVER 가 content 로 정규화)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { post: { id: "p-1" } }, error: null },
    });
    await patchAdminFeedPost({
      jwt: "j",
      id: "p-1",
      body: "수정된 본문",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/feed/posts/p-1`);
    expect(init.method).toBe("PATCH");
    const sent = JSON.parse(init.body as string);
    expect(sent.body).toBe("수정된 본문");
  });

  it("`is_hidden` alias 송신 (SERVER 가 status=hidden/published 로 매핑)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { post: { id: "p-1" } }, error: null },
    });
    await patchAdminFeedPost({
      jwt: "j",
      id: "p-1",
      is_hidden: true,
    });
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body as string);
    expect(sent.is_hidden).toBe(true);
  });

  it("`moderation_note` alias 송신 (SERVER 가 audit_log metadata 로 기록)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { post: { id: "p-1" } }, error: null },
    });
    await patchAdminFeedPost({
      jwt: "j",
      id: "p-1",
      moderation_note: "운영자 메모: 스팸 의심",
    });
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body as string);
    expect(sent.moderation_note).toBe("운영자 메모: 스팸 의심");
  });

  it("정형 `status` 토큰 송신", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { post: { id: "p-1" } }, error: null },
    });
    await patchAdminFeedPost({
      jwt: "j",
      id: "p-1",
      status: "removed",
    });
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body as string);
    expect(sent.status).toBe("removed");
  });
});

describe("contract alignment — GET /api/v1/admin/feed/posts alias query", () => {
  it("hidden=true alias 송신 (SERVER 가 status=hidden 으로 매핑)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { items: [], total: 0, page: 1, page_size: 50, next_cursor: null },
        error: null,
      },
    });
    await listAdminFeedPosts({ jwt: "j", hidden: "true" });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("hidden=true");
  });

  it("q + page + page_size + from + to query 송신", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { items: [], total: 0, page: 2, page_size: 10, next_cursor: null },
        error: null,
      },
    });
    await listAdminFeedPosts({
      jwt: "j",
      q: "hello",
      page: 2,
      page_size: 10,
      from: "2026-05-01T00:00:00Z",
      to: "2026-05-31T23:59:59Z",
    });
    const [url] = fetchMock.mock.calls[0];
    const s = String(url);
    expect(s).toContain("q=hello");
    expect(s).toContain("page=2");
    expect(s).toContain("page_size=10");
    expect(s).toContain("from=");
    expect(s).toContain("to=");
  });

  it("cursor + limit 모드 송신 (page 와 병존 가능)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { items: [], total: 0, page: 1, page_size: 20, next_cursor: null },
        error: null,
      },
    });
    await listAdminFeedPosts({ jwt: "j", cursor: "p-abc", limit: 20 });
    const [url] = fetchMock.mock.calls[0];
    const s = String(url);
    expect(s).toContain("cursor=p-abc");
    expect(s).toContain("limit=20");
  });
});
