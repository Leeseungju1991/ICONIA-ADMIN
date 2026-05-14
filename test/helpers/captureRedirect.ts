// `next/navigation`'s redirect() throws an internal error to abort. In tests we
// stub it: capture the URL on a sentinel error so callers can assert `.url`.
export class RedirectError extends Error {
  url: string;
  constructor(url: string) {
    super(`__REDIRECT__:${url}`);
    this.url = url;
    this.name = "RedirectError";
  }
}

export function makeRedirect() {
  return (url: string) => {
    throw new RedirectError(url);
  };
}

export async function expectRedirect(
  fn: () => Promise<unknown>,
): Promise<string> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof RedirectError) return err.url;
    throw err;
  }
  throw new Error("expected redirect, but action returned without redirecting");
}
