"use server";

// V1.0 #1 — Localhost 5개 서비스 health 통합 표시.
//
// 로컬 개발 환경에서 운영자가 어느 서비스가 떠 있는지 한 화면에서 확인하기 위한
// server-side ping 모음. DEPLOY_TARGET=local 일 때만 의미가 있다.
//
// 5개 서비스:
//   1. Server (자기 자신 — Admin 이 서버를 거치지 않으므로 Admin server action 이
//      직접 fetch). 정확한 health endpoint 는 Server 의 /api/v1/health.
//   2. AI service (3001) — /health
//   3. PostgreSQL — Server 가 prisma 로 도달 가능하면 ok. 별도 ping 불가하므로
//      Server overview 의 server_health=ok 로 간주.
//   4. Admin (this) — 본 action 응답 = ok
//   5. App (RN) — Node 측에서 ping 불가. 화면 안내만.

import { loadDeployTarget, loadEnv } from "@/lib/env";

export type ServicePing = {
  name: "server" | "ai" | "postgres" | "admin" | "app";
  status: "ok" | "down" | "unknown";
  detail: string;
};

export type LocalServicesHealth = {
  deploy_target: "local" | "aws";
  services: ServicePing[];
};

async function pingUrl(url: string, timeoutMs = 1500): Promise<{ ok: boolean; status: number | null; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: "GET", signal: controller.signal });
    return { ok: r.ok, status: r.status, detail: r.ok ? `HTTP ${r.status}` : `HTTP ${r.status}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: null, detail: msg.slice(0, 80) };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLocalServicesHealthAction(): Promise<LocalServicesHealth> {
  const target = loadDeployTarget();
  const env = loadEnv();

  // Server health (자기 자신을 거치지 않고 직접 ping — JWT 무관, /health 는 open).
  const serverPing = await pingUrl(`${env.ICONIA_SERVER_URL}/api/v1/health`);
  // AI service (.env 에 PERSONA_AI_BASE_URL 또는 default 3001).
  const aiBase =
    process.env.PERSONA_AI_BASE_URL ?? process.env.AI_SERVICE_URL ?? "http://localhost:3001";
  const aiPing = await pingUrl(`${aiBase}/health`);

  const services: ServicePing[] = [
    {
      name: "server",
      status: serverPing.ok ? "ok" : "down",
      detail: serverPing.detail,
    },
    {
      name: "ai",
      status: aiPing.ok ? "ok" : "down",
      detail: aiPing.detail,
    },
    {
      name: "postgres",
      status: serverPing.ok ? "ok" : "unknown",
      detail: serverPing.ok
        ? "Server 가 prisma 응답 — DB 도달 OK"
        : "Server down → DB 상태 unknown",
    },
    { name: "admin", status: "ok", detail: "본 화면 응답 = OK" },
    {
      name: "app",
      status: "unknown",
      detail: "RN 클라이언트는 server-side ping 불가. expo dev server 또는 디바이스에서 직접 확인.",
    },
  ];

  return { deploy_target: target, services };
}
