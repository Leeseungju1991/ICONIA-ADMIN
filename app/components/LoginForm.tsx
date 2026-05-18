"use client";

import { useFormState, useFormStatus } from "react-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { loginAction } from "@/lib/actions/login";
import { messageForCode, reasonMessage } from "@/lib/errorMessages";
import type { FormState } from "@/lib/types";

const initial: FormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      className="btn"
      type="submit"
      disabled={pending}
      aria-busy={pending}
      fullWidth
      size="large"
      sx={{ mt: 1, minHeight: 44 }}
    >
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" style={{ marginRight: 8 }} />
          확인 중…
        </>
      ) : (
        "로그인"
      )}
    </Button>
  );
}

export function LoginForm({ reason }: { reason?: string }) {
  const [state, action] = useFormState(loginAction, initial);
  const reasonMsg = reasonMessage(reason);
  const errorId = "login-form-error";
  const hasError = state.status === "error";

  return (
    <form action={action} noValidate>
      <Stack spacing={2}>
      {reasonMsg ? <Alert severity="info">{reasonMsg}</Alert> : null}
      {hasError ? (
        <Alert severity="error" role="alert" id={errorId}>
          {messageForCode(state.code)}
        </Alert>
      ) : null}
      <TextField
        id="username"
        name="username"
        type="text"
        label="아이디"
        required
        autoComplete="username"
        fullWidth
        error={hasError}
        InputLabelProps={{ shrink: true }}
        inputProps={{
          "aria-label": "아이디",
          "aria-invalid": hasError ? true : undefined,
          "aria-describedby": hasError ? errorId : undefined,
        }}
      />
      <TextField
        id="password"
        name="password"
        type="password"
        label="비밀번호"
        required
        autoComplete="current-password"
        fullWidth
        error={hasError}
        InputLabelProps={{ shrink: true }}
        inputProps={{
          "aria-label": "비밀번호",
          "aria-invalid": hasError ? true : undefined,
          "aria-describedby": hasError ? errorId : undefined,
        }}
      />
      <SubmitButton />
      </Stack>
    </form>
  );
}
