import { redirect } from "next/navigation";
import { readSession } from "@/lib/authCookie";

// P0 보안 정상화 (2026-05-19):
//   - localStorage 의존 제거 → 서버에서 cookie 보고 즉시 redirect.
//   - 클라이언트 useEffect 의 깜빡임/우회 제거.

export const dynamic = "force-dynamic";

export default function Home() {
  if (readSession()) {
    redirect("/dashboard");
  }
  redirect("/login");
}
