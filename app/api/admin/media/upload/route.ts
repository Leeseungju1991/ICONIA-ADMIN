// (주)숨코리아 — admin 미디어 업로드 route handler 프록시.
//
// 브라우저는 XHR (progress 이벤트 지원) 로 본 endpoint 를 호출한다. 이 핸들러는
// httpOnly 세션 쿠키를 읽어 Bearer 헤더를 붙이고 SERVER 의
// `POST /api/v1/admin/media/upload` 로 multipart 본문을 그대로 전달한다.
//
// 단일 책임: 인증 + URL 변환. 본문 변형 없음.

import { NextResponse } from "next/server";
import { readSession } from "@/lib/authCookie";
import { loadEnv } from "@/lib/env";

export const runtime = "nodejs";
// 대용량 비디오(최대 50MB) 업로드 시 64s 까지 허용 — Server timeout(60s) + 여유 4s.
export const maxDuration = 64;

export async function POST(req: Request): Promise<NextResponse> {
  const jwt = await readSession();
  if (!jwt) {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        error: { code: "ERR_UNAUTHORIZED", message: "session_expired" },
      },
      { status: 401 },
    );
  }

  const env = loadEnv();
  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        error: { code: "ERR_VALIDATION", message: "file_field_required" },
      },
      { status: 400 },
    );
  }

  // 그대로 forward — 본문 변형 없음.
  const forward = new FormData();
  forward.append("file", file);

  let upstream: Response;
  try {
    upstream = await fetch(`${env.ICONIA_SERVER_URL}/api/v1/admin/media/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, Accept: "application/json" },
      body: forward,
      cache: "no-store",
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        ok: false,
        data: null,
        error: {
          code: "ERR_NETWORK",
          message: isTimeout ? "request_timeout" : "network_error",
        },
      },
      { status: 502 },
    );
  }

  // 응답을 그대로 stream / parse. 5xx 는 graceful 매핑.
  if (upstream.status >= 500) {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        error: { code: "ERR_SERVER_UNAVAILABLE", message: "server_unavailable" },
      },
      { status: upstream.status },
    );
  }
  let body: unknown;
  try {
    body = await upstream.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        data: null,
        error: { code: "ERR_INVALID_RESPONSE", message: "invalid_response" },
      },
      { status: upstream.status },
    );
  }
  return NextResponse.json(body, { status: upstream.status });
}
