"use client";

import { useFormState, useFormStatus } from "react-dom";
import { forceLogoutUserAction } from "@/lib/actions/forceLogoutUser";
import { messageForCode } from "@/lib/errorMessages";
import type { FormState } from "@/lib/types";

const initial: FormState = { status: "idle" };

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn"
      style={{ width: "auto", background: "#7a1d1d" }}
      disabled={pending}
    >
      {pending ? "처리 중…" : "강제 로그아웃 (모든 세션 revoke)"}
    </button>
  );
}

// Wrapper because forceLogoutUserAction signature is (FormData) only — useFormState
// expects (prev, FormData). Adapt here.
async function action(_prev: FormState, formData: FormData): Promise<FormState> {
  return forceLogoutUserAction(formData);
}

export function ForceLogoutButton({ userId }: { userId: string }) {
  const [state, dispatch] = useFormState(action, initial);

  return (
    <form action={dispatch}>
      <input type="hidden" name="user_id" value={userId} />
      {state.status === "error" ? (
        <div className="error" role="alert">
          {messageForCode(state.code)}
        </div>
      ) : null}
      {state.status === "idle" && state.message ? (
        <div className="notice">{state.message}</div>
      ) : null}
      <Button />
    </form>
  );
}
