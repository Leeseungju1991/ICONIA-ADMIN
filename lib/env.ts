export type AdminEnv = {
  ICONIA_SERVER_URL: string;
  COOKIE_SECURE: boolean;
};

export function loadEnv(): AdminEnv {
  const raw = process.env.ICONIA_SERVER_URL;
  if (!raw) {
    throw new Error("ICONIA_SERVER_URL is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`ICONIA_SERVER_URL is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `ICONIA_SERVER_URL must be http(s); got ${parsed.protocol}`,
    );
  }
  const normalized = raw.replace(/\/+$/, "");
  return {
    ICONIA_SERVER_URL: normalized,
    COOKIE_SECURE: process.env.NODE_ENV === "production",
  };
}
