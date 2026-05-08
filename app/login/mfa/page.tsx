import { redirect } from "next/navigation";
import { MfaForm } from "@/app/components/MfaForm";

export default function MfaPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams?.token;
  if (!token) {
    redirect("/login?reason=mfa_expired");
  }
  return (
    <main className="center">
      <div className="card">
        <h1>2단계 인증</h1>
        <p className="subtitle">
          앱의 6자리 코드를 입력하거나, 복구 코드로 로그인할 수 있습니다.
        </p>
        <MfaForm token={token!} />
      </div>
    </main>
  );
}
