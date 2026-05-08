"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { mfaAction } from "@/lib/actions/mfa";
import { messageForCode } from "@/lib/errorMessages";
import type { FormState } from "@/lib/types";

const initial: FormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "확인 중…" : "확인"}
    </button>
  );
}

export function MfaForm({ token }: { token: string }) {
  const [state, action] = useFormState(mfaAction, initial);
  const [mode, setMode] = useState<"totp" | "recovery">("totp");

  return (
    <form action={action} noValidate>
      {state.status === "error" ? (
        <div className="error" role="alert">
          {messageForCode(state.code)}
        </div>
      ) : null}

      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value={mode} />

      <div className="form-row">
        <label htmlFor="code">
          {mode === "totp" ? "TOTP 6자리 코드" : "복구 코드"}
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode={mode === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          required
          pattern={mode === "totp" ? "[0-9]{6}" : undefined}
          maxLength={mode === "totp" ? 6 : 64}
        />
      </div>

      <SubmitButton />

      <button
        type="button"
        className="btn secondary"
        onClick={() => setMode((m) => (m === "totp" ? "recovery" : "totp"))}
        style={{ marginTop: 10 }}
      >
        {mode === "totp" ? "복구 코드로 입력" : "TOTP 코드로 입력"}
      </button>
    </form>
  );
}
