// P1 §7 (2026-05-19) — PII 응답 마스킹.
//
// 운영자 콘솔의 list/detail view 는 기본적으로 *마스킹된* 표면을 보여주고,
// 마스킹 해제는 명시적 액션 (2FA 재확인 + audit log) 을 통해야 한다.
//
// 본 모듈은 *표시* 마스킹만 담당 — 서버 응답 자체에 raw PII 가 포함되어 있다는 점에
// 유의 (서버 측 token-scoped masking 은 별도 작업, 사용자 결정사항 참조).

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return mask(trimmed, 1);
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return `${mask(local, 2)}@${maskDomain(domain)}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  // 한국식 010-1234-5678 → 010-****-5678
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  }
  // 일반: 끝 4 자리만 노출
  return `***-***-${digits.slice(-4)}`;
}

export function maskUserId(id: string | null | undefined): string {
  if (!id) return "";
  const s = id.trim();
  if (s.length <= 6) return mask(s, 2);
  return `${s.slice(0, 4)}…${s.slice(-2)}`;
}

export function maskName(name: string | null | undefined): string {
  if (!name) return "";
  const s = name.trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return `${s[0]}*`;
  return `${s[0]}${"*".repeat(s.length - 2)}${s.slice(-1)}`;
}

function mask(s: string, prefixVisible: number): string {
  if (s.length <= prefixVisible) return "*".repeat(s.length);
  return s.slice(0, prefixVisible) + "*".repeat(Math.max(2, s.length - prefixVisible));
}

function maskDomain(d: string): string {
  const dot = d.lastIndexOf(".");
  if (dot <= 0) return mask(d, 1);
  const host = d.slice(0, dot);
  const tld = d.slice(dot);
  return `${mask(host, 1)}${tld}`;
}
