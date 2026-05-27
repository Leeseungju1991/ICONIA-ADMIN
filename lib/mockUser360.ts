export type User360Snapshot = {
  user: {
    id: string;
    email: string;
    account_status: "active" | "suspended" | "deleted";
    joined_at: string;
  };
  devices: Array<{
    serial: string;
    firmware_version: string;
    battery_pct: number;
    last_seen: string;
    online: boolean;
  }>;
  server: {
    active_sessions: number;
    refresh_tokens_24h: number;
    rate_limit_state: "ok" | "throttled";
    pipa_consent_version: string;
  };
  ai: {
    persona_name: string;
    persona_version: string;
    fallback_rate_24h: number;
    avg_latency_ms: number;
    compression_events_24h: number;
  };
  app: {
    app_version: string;
    os: string;
    model: string;
    last_push_at: string | null;
    last_crash: { at: string; type: string; message: string } | null;
  };
};

export type User360Event = {
  id: string;
  at: string;
  kind: "login" | "logout" | "pairing" | "ota" | "report" | "ai_fallback" | "admin_action";
  title: string;
  meta?: string;
};

function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

function pseudo(seed: number, n: number): number[] {
  const out: number[] = [];
  let s = seed || 1;
  for (let i = 0; i < n; i += 1) {
    s = (s * 1103515245 + 12345) >>> 0;
    out.push(s);
  }
  return out;
}

const PERSONAS = ["Aria", "Mio", "Lia", "Yuna", "Noa", "Reni"];
const MODELS = ["iPhone 15 Pro", "Galaxy S24", "Pixel 9", "iPhone 14"];
const OS_LIST = ["iOS 17.5", "Android 14", "iOS 18.0", "Android 15"];

export function mockUser360Snapshot(key: string): User360Snapshot {
  const seed = hashSeed(key);
  const r = pseudo(seed, 20);
  const id = `usr_${seed.toString(16).padStart(8, "0")}`;
  const devices = Array.from({ length: 1 + (r[0] % 2) }, (_, i) => ({
    serial: `IC-${(seed + i).toString(16).slice(-8).toUpperCase()}`,
    firmware_version: `1.${(r[i + 1] % 5) + 2}.${r[i + 3] % 10}`,
    battery_pct: 15 + (r[i + 5] % 80),
    last_seen: new Date(Date.now() - (r[i + 7] % 86_400_000)).toISOString(),
    online: (r[i + 9] % 3) !== 0,
  }));
  return {
    user: {
      id,
      email: key.includes("@") ? key : `${id}@iconia.example`,
      account_status: "active",
      joined_at: new Date(Date.now() - 86_400_000 * (30 + (r[11] % 365))).toISOString(),
    },
    devices,
    server: {
      active_sessions: 1 + (r[12] % 3),
      refresh_tokens_24h: 4 + (r[13] % 8),
      rate_limit_state: r[14] % 7 === 0 ? "throttled" : "ok",
      pipa_consent_version: "v3.1",
    },
    ai: {
      persona_name: PERSONAS[r[15] % PERSONAS.length],
      persona_version: `2026.0${1 + (r[16] % 5)}`,
      fallback_rate_24h: Number(((r[17] % 500) / 10000).toFixed(4)),
      avg_latency_ms: 600 + (r[18] % 800),
      compression_events_24h: r[19] % 12,
    },
    app: {
      app_version: `1.${1 + (r[0] % 3)}.${r[1] % 10}`,
      os: OS_LIST[r[2] % OS_LIST.length],
      model: MODELS[r[3] % MODELS.length],
      last_push_at: new Date(Date.now() - (r[4] % 3_600_000)).toISOString(),
      last_crash:
        r[5] % 4 === 0
          ? {
              at: new Date(Date.now() - (r[6] % 86_400_000)).toISOString(),
              type: "JSExceptionFatal",
              message: "TypeError: Cannot read properties of undefined (reading 'persona')",
            }
          : null,
    },
  };
}

export function mockUser360Timeline(key: string): User360Event[] {
  const seed = hashSeed(key);
  const r = pseudo(seed, 32);
  const kinds: User360Event["kind"][] = [
    "login", "logout", "pairing", "ota", "report", "ai_fallback", "admin_action",
  ];
  const events = Array.from({ length: 16 }, (_, i) => {
    const kind = kinds[r[i] % kinds.length];
    return {
      id: `evt_${seed.toString(16)}_${i}`,
      at: new Date(Date.now() - i * 3_600_000 - (r[i + 1] % 1_800_000)).toISOString(),
      kind,
      title: titleFor(kind),
      meta: metaFor(kind, r[i + 2]),
    };
  });
  return events.sort((a, b) => (a.at < b.at ? 1 : -1));
}

function titleFor(kind: User360Event["kind"]): string {
  switch (kind) {
    case "login": return "로그인 성공";
    case "logout": return "로그아웃";
    case "pairing": return "디바이스 페어링";
    case "ota": return "OTA 업데이트";
    case "report": return "게시물 신고됨";
    case "ai_fallback": return "AI 응답 fallback";
    case "admin_action": return "운영자 조치";
  }
}
function metaFor(kind: User360Event["kind"], n: number): string {
  switch (kind) {
    case "login": return n % 2 ? "iOS · 서울" : "Android · 부산";
    case "logout": return "정상";
    case "pairing": return `IC-${n.toString(16).slice(-6).toUpperCase()}`;
    case "ota": return n % 2 ? "성공 1.4.1 → 1.4.2" : "실패 (timeout)";
    case "report": return n % 2 ? "abusive" : "spam";
    case "ai_fallback": return "key_pool exhausted → secondary";
    case "admin_action": return n % 2 ? "force_logout" : "post_hidden";
  }
}
