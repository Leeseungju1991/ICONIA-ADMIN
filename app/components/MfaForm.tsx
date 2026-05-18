"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { mfaAction } from "@/lib/actions/mfa";
import { messageForCode } from "@/lib/errorMessages";
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
      sx={{ minHeight: 44 }}
    >
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" style={{ marginRight: 8 }} />
          확인 중…
        </>
      ) : (
        "확인"
      )}
    </Button>
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
  const codeLabel = mode === "totp" ? "TOTP 6자리 코드" : "복구 코드";

  return (
    <form action={action} noValidate>
      <Stack spacing={2}>
      {hasError ? (
        <Alert severity="error" role="alert" id={errorId}>
          {messageForCode(state.code)}
        </Alert>
      ) : null}

      {/* hidden token / mode 는 raw <input> 으로 유지 — 테스트가 container.querySelector('input[name="token"]')
          으로 접근하기 때문 (MfaForm.test.tsx). */}
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value={mode} />

      <TextField
        id="code"
        name="code"
        type="text"
        label={codeLabel}
        required
        fullWidth
        InputLabelProps={{ shrink: true }}
        inputProps={{
          inputMode: mode === "totp" ? "numeric" : "text",
          autoComplete: "one-time-code",
          pattern: mode === "totp" ? "[0-9]{6}" : undefined,
          maxLength: mode === "totp" ? 6 : 64,
          "aria-label": codeLabel,
          "aria-invalid": hasError ? true : undefined,
          "aria-describedby": hasError ? errorId : undefined,
        }}
        error={hasError}
        onInvalid={(e) => setKoreanValidity(e as React.SyntheticEvent<HTMLInputElement>, mode)}
        onInput={(e) => (e.currentTarget as HTMLInputElement).setCustomValidity("")}
      />

      <SubmitButton />

      <Button
        type="button"
        variant="outlined"
        className="btn secondary"
        fullWidth
        onClick={() => setMode((m) => (m === "totp" ? "recovery" : "totp"))}
      >
        {mode === "totp" ? "복구 코드로 입력" : "TOTP 코드로 입력"}
      </Button>
      </Stack>
    </form>
  );
}
