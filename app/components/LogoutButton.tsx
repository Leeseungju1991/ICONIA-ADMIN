import { logoutAction } from "@/lib/actions/logout";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="btn secondary" style={{ width: "auto" }}>
        로그아웃
      </button>
    </form>
  );
}
