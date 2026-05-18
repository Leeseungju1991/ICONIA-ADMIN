import RequireAuth from "@/app/components/RequireAuth";
import Sidebar from "./Sidebar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <Sidebar>{children}</Sidebar>
    </RequireAuth>
  );
}
