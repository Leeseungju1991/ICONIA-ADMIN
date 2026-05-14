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
    <button
      className="btn"
      type="submit"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" /> 확인 중…
        </>
      ) : (
        "확인"
      )}
    </button>
  );
}

// Native HTML validation 메시지가 영문으로 노출되는 것을 방지 — 한국어 메시지로 교체.
function setKoreanValidity(e: React.SyntheticEvent<HTMLInputElement>, mode: "totp" | "recovery") {
  const input = e.currentTarget;
  if (input.validity.valueMissing) {
    input.setCustomValidity(
      mode === "totp" ? "TOTP 6자리 코드를 입력해 주세요." : "복구 코드를 입력해 주세요."
    );
  } else if (input.validity.patternMismatch || input.validity.tooShort) {
    input.setCustomValidity("TOTP 코드는 숫자 6자리여야 합니다.");
  } else {
    input.setCustomValidity("");
  }
}

export function MfaForm({ token }: { token: string }) {
  const [state, action] = useFormState(mfaAction, initial);
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const errorId = "mfa-form-error";
  const hasError = state.status === "error";

  return (
    <form action={action} noValidate>
      {hasError ? (
        <div className="error" role="alert" id={errorId}>
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
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? errorId : undefined}
          onInvalid={(e) => setKoreanValidity(e, mode)}
          onInput={(e) => e.currentTarget.setCustomValidity("")}
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
