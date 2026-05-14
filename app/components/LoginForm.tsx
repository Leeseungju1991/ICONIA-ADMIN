"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "@/lib/actions/login";
import { messageForCode, reasonMessage } from "@/lib/errorMessages";
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
        "로그인"
      )}
    </button>
  );
}

export function LoginForm({ reason }: { reason?: string }) {
  const [state, action] = useFormState(loginAction, initial);
  const reasonMsg = reasonMessage(reason);
  const errorId = "login-form-error";
  const hasError = state.status === "error";

  return (
    <form action={action} noValidate>
      {reasonMsg ? <div className="notice">{reasonMsg}</div> : null}
      {hasError ? (
        <div className="error" role="alert" id={errorId}>
          {messageForCode(state.code)}
        </div>
      ) : null}
      <div className="form-row">
        <label htmlFor="email">이메일</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? errorId : undefined}
        />
      </div>
      <div className="form-row">
        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? errorId : undefined}
        />
      </div>
      <SubmitButton />
    </form>
  );
}
