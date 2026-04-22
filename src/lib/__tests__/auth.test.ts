// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

// Mock server-only so it doesn't throw in test environment
vi.mock("server-only", () => ({}));

// Mock next/headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Import after mocks are set up
import { createSession } from "@/lib/auth";

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets an httpOnly cookie with a JWT token", async () => {
    await createSession("user-123", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, token, options] = mockCookieStore.set.mock.calls[0];

    expect(name).toBe("auth-token");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT format
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
    expect(options.sameSite).toBe("lax");
  });

  test("sets cookie expiry ~7 days in the future", async () => {
    const before = Date.now();
    await createSession("user-123", "test@example.com");
    const after = Date.now();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    const expiresMs = options.expires.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("embeds userId and email in the JWT payload", async () => {
    await createSession("user-abc", "hello@example.com");

    const [, token] = mockCookieStore.set.mock.calls[0];
    const secret = new TextEncoder().encode("development-secret-key");
    const { payload } = await jwtVerify(token, secret);

    expect(payload.userId).toBe("user-abc");
    expect(payload.email).toBe("hello@example.com");
  });

  test("signs the JWT with HS256 and a 7-day expiry", async () => {
    const before = Math.floor(Date.now() / 1000);
    await createSession("user-123", "test@example.com");
    const after = Math.floor(Date.now() / 1000);

    const [, token] = mockCookieStore.set.mock.calls[0];
    const [headerB64] = token.split(".");
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    expect(header.alg).toBe("HS256");

    const secret = new TextEncoder().encode("development-secret-key");
    const { payload } = await jwtVerify(token, secret);
    const sevenDays = 7 * 24 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDays);
    expect(payload.exp).toBeLessThanOrEqual(after + sevenDays + 1);
  });

  test("sets secure flag only in production", async () => {
    const original = process.env.NODE_ENV;

    process.env.NODE_ENV = "production";
    await createSession("user-123", "test@example.com");
    const [, , prodOptions] = mockCookieStore.set.mock.calls[0];
    expect(prodOptions.secure).toBe(true);

    vi.clearAllMocks();

    process.env.NODE_ENV = "development";
    await createSession("user-123", "test@example.com");
    const [, , devOptions] = mockCookieStore.set.mock.calls[0];
    expect(devOptions.secure).toBe(false);

    process.env.NODE_ENV = original;
  });
});

