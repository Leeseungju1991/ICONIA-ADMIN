// Shim for React's `react-dom` form-action hooks (`useFormState` / `useFormStatus`).
//
// The app imports `{ useFormState, useFormStatus } from "react-dom"` — in production
// Next.js aliases `react-dom` to its bundled (canary) build that ships those hooks.
// The plain `react-dom@18.3.1` in node_modules does NOT export them, so component
// tests must `vi.mock("react-dom", () => formActionsReactDomMock(actual))`.
//
// The shimmed `useFormState` returns `[state, formAction]` exactly like the real one
// (`formAction(formData)` → `action(prevState, formData)` → state update). The latest
// `formAction` of each render is also exposed on `globalThis.__lastFormAction__` so a
// test can invoke it directly (bare react-dom@18.3.1 does not handle `<form action={fn}>`
// natively, so a real submit event would not reach the action).
import * as React from "react";

declare global {
  // eslint-disable-next-line no-var
  var __lastFormAction__: ((formData: FormData) => void) | undefined;
}

type AnyAction = (prev: unknown, formData: FormData) => unknown | Promise<unknown>;

export function makeFormHooks() {
  function useFormState<S>(action: AnyAction, initialState: S): [S, (formData: FormData) => void] {
    const [state, setState] = React.useState<S>(initialState);
    const stateRef = React.useRef(state);
    stateRef.current = state;
    const formAction = React.useCallback(
      (formData: FormData) => {
        Promise.resolve(action(stateRef.current, formData)).then((next) => {
          setState(next as S);
        });
      },
      [action],
    );
    globalThis.__lastFormAction__ = formAction;
    return [state, formAction];
  }
  function useFormStatus() {
    return { pending: false, data: null, method: null, action: null };
  }
  return { useFormState, useFormStatus };
}

/** Build the `react-dom` mock object: spread the real module + the form hooks. */
export function formActionsReactDomMock(actual: Record<string, unknown>) {
  return { ...actual, ...makeFormHooks() };
}

/** Invoke the most recently rendered `useFormState` dispatcher with a FormData. */
export function submitLastFormAction(formData: FormData): void {
  if (!globalThis.__lastFormAction__) {
    throw new Error("no form action captured — did the component render useFormState?");
  }
  globalThis.__lastFormAction__(formData);
}
