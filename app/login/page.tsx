import { LoginForm } from "@/app/components/LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  return (
    <main className="center">
      <div className="card">
        <h1>ICONIA 운영 콘솔</h1>
        <p className="subtitle">운영자 계정으로 로그인하세요.</p>
        <LoginForm reason={searchParams?.reason} />
      </div>
    </main>
  );
}
