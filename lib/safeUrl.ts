// safeUrl.ts — 운영자 콘솔 내 사용자 제공 URL 렌더링 보안 유틸.
//
// 목적:
//   - `javascript:` URI 를 img src / a href / video src 에 그대로 사용하면
//     XSS 경로가 열린다. CSP `img-src` 가 img 로드를 차단하지만 `<a href>` 클릭은
//     막지 않는다. admin 콘솔이 서버 데이터를 직접 렌더하는 부분에서 방어 계층 추가.
//
// 사용:
//   - `safeImgSrc(url)` : 허용되지 않으면 undefined 반환 → img src 에 넣으면 렌더 X.
//   - `safeHref(url)`   : 허용되지 않으면 "#" 반환 → 클릭해도 페이지 이동만.
//   - `safeVideoSrc(url)`: 허용되지 않으면 undefined → video 태그가 소스 없이 렌더.
//
// 허용 프로토콜:
//   img/video : https:, data:, blob: (http: 는 mixed-content → 브라우저가 차단. 허용 X.)
//   a href    : https:, http: (외부 원본 링크), mailto:, # (상대 경로)

const SAFE_IMG_PROTOCOLS: ReadonlySet<string> = new Set(["https:", "data:", "blob:"]);
const SAFE_HREF_PROTOCOLS: ReadonlySet<string> = new Set(["https:", "http:", "mailto:"]);

function parseProtocol(url: string): string | null {
  try {
    return new URL(url).protocol;
  } catch {
    // 상대 경로 또는 "#" 등은 protocol 파싱 실패 → 안전하지 않다고 본다.
    return null;
  }
}

/** img/video src 에 사용 가능한 URL 이면 그대로, 아니면 undefined. */
export function safeImgSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const protocol = parseProtocol(url);
  if (!protocol) return undefined;
  return SAFE_IMG_PROTOCOLS.has(protocol) ? url : undefined;
}

/** <a href> 에 사용 가능한 URL 이면 그대로, 아니면 "#" (무해한 앵커). */
export function safeHref(url: string | null | undefined): string {
  if (!url) return "#";
  const protocol = parseProtocol(url);
  if (!protocol) return "#";
  return SAFE_HREF_PROTOCOLS.has(protocol) ? url : "#";
}

/** video src 에 사용 가능한 URL 이면 그대로, 아니면 undefined. */
export function safeVideoSrc(url: string | null | undefined): string | undefined {
  return safeImgSrc(url);
}
