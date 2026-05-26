// ICONIA-Admin i18n — 운영자 locale 분리 (ko/en).
// 기본 locale 은 `ADMIN_DEFAULT_LOCALE` env, 미설정 시 'ko'.
// 운영자 환경설정(쿠키) 가 있으면 그것을 우선.

import { messagesKo } from "./messages-ko";
import { messagesEn } from "./messages-en";

export type Locale = "ko" | "en";

const CATALOGS: Record<Locale, typeof messagesKo> = {
  ko: messagesKo,
  // 영어 카탈로그는 ko 와 동일 shape — 누락 키는 ko 로 fallback.
  en: messagesEn as unknown as typeof messagesKo,
};

const FALLBACK: Locale = "ko";

/**
 * 키를 받아 현재 locale 의 메시지 반환. 누락 시 fallback locale, 그래도 없으면 키 자체.
 * `t('common.save')` 와 같이 dot-notation 으로 호출.
 */
export function t(key: string, locale: Locale = FALLBACK): string {
  const catalog = CATALOGS[locale] ?? CATALOGS[FALLBACK];
  const value = resolveKey(catalog, key);
  if (typeof value === "string") return value;
  // fallback to KO
  const fallbackValue = resolveKey(CATALOGS[FALLBACK], key);
  return typeof fallbackValue === "string" ? fallbackValue : key;
}

function resolveKey(catalog: unknown, key: string): unknown {
  const parts = key.split(".");
  let cur: unknown = catalog;
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || !(p in (cur as Record<string, unknown>))) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * 운영자가 선호하는 locale 결정. 우선순위:
 *  1. cookie `admin_locale=ko|en`
 *  2. env `ADMIN_DEFAULT_LOCALE`
 *  3. 'ko'
 */
export function resolveLocale(cookieValue?: string | null): Locale {
  if (cookieValue === "ko" || cookieValue === "en") return cookieValue;
  const env = process.env.ADMIN_DEFAULT_LOCALE;
  if (env === "ko" || env === "en") return env;
  return FALLBACK;
}

export const SUPPORTED_LOCALES: Locale[] = ["ko", "en"];
