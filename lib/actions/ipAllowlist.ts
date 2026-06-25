"use server";

// 2026-06-25 — [PDF #11] IP 허용목록 server actions.
//   Server endpoint: GET/POST/DELETE /api/v1/admin/security/ip-allowlist
//   superadmin 전용. CIDR 또는 단일 IP(IPv4/IPv6) 형식 허용.
//
//   이전: ip-allowlist/page.tsx 에 인라인 stub 함수 (`ERR_NOT_IMPLEMENTED` 반환).
//   현재: adminApi.ts 의 실 함수 호출 + 친화 에러 매핑.

import { readSession } from "@/lib/authCookie";
import {
  listIpAllowlist,
  addIpAllowlist,
  deleteIpAllowlist,
  type IpAllowlistEntry,
} from "@/lib/adminApi";

type ActionOk<T> = { ok: true; data: T };
type ActionErr = { ok: false; message: string; code?: string };
export type IpAllowlistActionResult<T> = ActionOk<T> | ActionErr;

// ── CIDR / IP 형식 검증 (클라·서버 양쪽 적용) ──────────────────────────
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
const IPV6_ROUGH = /^[0-9a-fA-F:]+(%\w+)?(\/\d{1,3})?$/;

function validateCidr(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "CIDR / IP 를 입력하세요.";
  if (!IPV4.test(v) && !IPV6_ROUGH.test(v)) {
    return "올바른 CIDR 또는 IP 형식을 입력하세요 (예: 203.0.113.0/24 또는 1.2.3.4).";
  }
  // IPv4 옥텟 범위 검사
  if (IPV4.test(v)) {
    const [ip] = v.split("/");
    const octets = ip.split(".").map(Number);
    if (octets.some((o) => o > 255)) return "IPv4 옥텟 값이 0–255 범위를 벗어났습니다.";
    const prefixStr = v.split("/")[1];
    if (prefixStr !== undefined) {
      const prefix = Number(prefixStr);
      if (prefix < 0 || prefix > 32) return "IPv4 prefix 는 0–32 범위여야 합니다.";
    }
  }
  return null;
}

export async function listIpAllowlistAction(): Promise<
  IpAllowlistActionResult<{ items: IpAllowlistEntry[] }>
> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listIpAllowlist({ jwt });
  if (!res.ok) return { ok: false, code: res.code, message: res.message };
  return { ok: true, data: { items: res.data.items } };
}

export async function addIpAllowlistAction(args: {
  cidr: string;
  label?: string;
}): Promise<IpAllowlistActionResult<{ entry: IpAllowlistEntry }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };

  const err = validateCidr(args.cidr);
  if (err) return { ok: false, message: err };

  const res = await addIpAllowlist({
    jwt,
    cidr: args.cidr.trim(),
    label: args.label?.trim(),
  });
  if (!res.ok) {
    const msg = friendlyIpMessage(res.code, res.message);
    return { ok: false, code: res.code, message: msg };
  }
  return { ok: true, data: { entry: res.data.entry } };
}

export async function deleteIpAllowlistAction(args: {
  id: string;
}): Promise<IpAllowlistActionResult<{ deleted: true }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.id.trim()) return { ok: false, message: "id 누락" };

  const res = await deleteIpAllowlist({ jwt, id: args.id.trim() });
  if (!res.ok) {
    return { ok: false, code: res.code, message: friendlyIpMessage(res.code, res.message) };
  }
  return { ok: true, data: { deleted: true } };
}

function friendlyIpMessage(code: string | undefined, raw: string): string {
  switch (code) {
    case "ERR_CONFLICT":
      return "이미 등록된 CIDR / IP 입니다.";
    case "ERR_NOT_FOUND":
      return "대상 항목을 찾을 수 없습니다.";
    case "ERR_FORBIDDEN":
    case "ERR_NOT_AUTHORIZED":
    case "ERR_OPERATOR_NOT_AUTHORIZED":
      return "이 작업은 최고관리자(superadmin)만 수행할 수 있습니다.";
    case "ERR_VALIDATION":
      return "CIDR 형식이 올바르지 않습니다.";
    case "ERR_SERVER_UNAVAILABLE":
    case "ERR_INTERNAL":
      return "일시적인 서버 오류입니다. 잠시 후 다시 시도하세요.";
    default:
      return raw && raw.length > 0 ? raw : "처리 중 오류가 발생했습니다.";
  }
}
