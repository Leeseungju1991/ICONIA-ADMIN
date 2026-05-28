import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// next.config.mjs reads process.env at module-evaluation time (allowedOrigins,
// CSP connect-src, HSTS). Reset the module registry per env permutation so the
// re-import re-evaluates against the new env.

type HeaderEntry = { key: string; value: string };
type HeaderBlock = { source: string; headers: HeaderEntry[] };
type NextConfigLike = {
  output?: string;
  poweredByHeader?: boolean;
  reactStrictMode?: boolean;
  experimental?: { serverActions?: { allowedOrigins?: string[] } };
  headers?: () => Promise<HeaderBlock[]>;
};

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// tsconfig has allowJs:false, so a *static* import-specifier of the .mjs would
// fail `tsc --noEmit`. Going through a variable makes `import()` resolve to
// Promise<any> at type-check time while vite still loads the real file at runtime.
const CONFIG_SPECIFIER: string = "./next.config.mjs";

async function loadConfig(): Promise<NextConfigLike> {
  const mod = (await import(CONFIG_SPECIFIER)) as { default: NextConfigLike };
  return mod.default;
}

function headerMap(block: HeaderBlock): Record<string, string> {
  return Object.fromEntries(block.headers.map((h) => [h.key, h.value]));
}

describe("next.config security", () => {
  it("emits a standalone server bundle", async () => {
    const cfg = await loadConfig();
    expect(cfg.output).toBe("standalone");
  });

  it("disables the X-Powered-By header and enables strict mode", async () => {
    const cfg = await loadConfig();
    expect(cfg.poweredByHeader).toBe(false);
    expect(cfg.reactStrictMode).toBe(true);
  });

  it("headers() returns the security header block for /:path*", async () => {
    const cfg = await loadConfig();
    expect(typeof cfg.headers).toBe("function");
    const blocks = await cfg.headers!();
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].source).toBe("/:path*");

    const byKey = headerMap(blocks[0]);
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Permissions-Policy"]).toContain("camera=()");
    expect(byKey["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(byKey["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });

  it("CSP locks down default-src/object-src/frame-ancestors/form-action/base-uri", async () => {
    // upgrade-insecure-requests 는 prod 만 — dev/test 에선 http://localhost 강제 차단을 막기 위해 제외.
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    const cfg = await loadConfig();
    const blocks = await cfg.headers!();
    const csp = headerMap(blocks[0])["Content-Security-Policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("img-src 'self' data: https:");
  });

  it("includes the Server API host in connect-src when ADMIN_API_HOST is set", async () => {
    process.env.ADMIN_API_HOST = "https://api.iconia.example";
    delete process.env.ICONIA_SERVER_URL;
    const cfg = await loadConfig();
    const blocks = await cfg.headers!();
    expect(headerMap(blocks[0])["Content-Security-Policy"]).toContain(
      "connect-src 'self' https://api.iconia.example",
    );
  });

  it("emits HSTS only in production", async () => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    const prodCfg = await loadConfig();
    const prodByKey = headerMap((await prodCfg.headers!())[0]);
    expect(prodByKey["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(prodByKey["Strict-Transport-Security"]).toContain("includeSubDomains");

    vi.resetModules();
    (process.env as { NODE_ENV?: string }).NODE_ENV = "development";
    const devCfg = await loadConfig();
    const devByKey = headerMap((await devCfg.headers!())[0]);
    expect(devByKey["Strict-Transport-Security"]).toBeUndefined();
  });

  it("always includes localhost:3000 in Server Actions allowedOrigins; merges ADMIN_ALLOWED_ORIGIN", async () => {
    process.env.ADMIN_ALLOWED_ORIGIN = "admin.iconia.example, admin2.iconia.example";
    const cfg = await loadConfig();
    const origins = cfg.experimental?.serverActions?.allowedOrigins ?? [];
    expect(origins).toContain("localhost:3000");
    expect(origins).toContain("admin.iconia.example");
    expect(origins).toContain("admin2.iconia.example");
  });
});
