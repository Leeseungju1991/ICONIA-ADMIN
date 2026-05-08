// Display-only JWT payload decode. Signature is NOT verified — Server is the
// real boundary. Use exclusively to surface non-sensitive identity fields
// (email, role) on the client UI; never for authorization decisions.

export function decodeJwtPayloadUnsafe(
  jwt: string | null | undefined,
): Record<string, unknown> | null {
  if (!jwt || typeof jwt !== "string") return null;
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  const padded =
    parts[1].replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((parts[1].length + 3) % 4);
  let json: string;
  try {
    json = Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
