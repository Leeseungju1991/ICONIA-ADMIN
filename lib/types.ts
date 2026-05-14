// Single-user admin — no role hierarchy. Server may still include `role` in
// responses; admin-web ignores it.
export type OperatorPublic = {
  id: string;
  email: string;
};

export type ServerOk<T> = { ok: true; data: T };
export type ServerErr = {
  ok: false;
  code: string;
  message: string;
  status: number;
  details?: unknown;
};

export type ServerResult<T> = ServerOk<T> | ServerErr;

export type LoginStep1Mfa = { mfa_session_token: string; mfa_required: true };
export type LoginIssued = {
  jwt: string;
  expires_at: string;
  operator: OperatorPublic;
};
export type LoginStep1Response = LoginStep1Mfa | LoginIssued;
export type LoginStep2Response = LoginIssued;

export type ServerEnvelope<T> =
  | { ok: true; data: T; error: null; meta?: unknown }
  | {
      ok: false;
      data: null;
      error: { code: string; message: string; details?: unknown };
      meta?: unknown;
    };

export type FormState = {
  status: "idle" | "error";
  code?: string;
  message?: string;
};
