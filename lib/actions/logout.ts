"use server";

import { redirect } from "next/navigation";

import { operatorLogout } from "../serverApi";
import { clearSession, readSession } from "../authCookie";

export async function logoutAction(): Promise<void> {
  const jwt = readSession();
  if (jwt) {
    try {
      await operatorLogout(jwt);
    } catch {
      // best-effort: cookie clear is the contract.
    }
  }
  clearSession();
  redirect("/login");
}
