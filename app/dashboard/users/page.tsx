import { readSession } from "@/lib/authCookie";
import { resolveIdentity } from "@/lib/identity";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const jwt = readSession();
  const identity = await resolveIdentity(jwt);
  const csMode = identity?.role === "cs";

  return <UsersClient csMode={csMode} />;
}
