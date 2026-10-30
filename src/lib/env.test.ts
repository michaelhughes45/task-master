import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const VALID = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
};

// The module parses process.env on import, so give it a valid one first
for (const [key, value] of Object.entries(VALID)) vi.stubEnv(key, value);
const { parseEnv } = await import("./env");

describe("parseEnv", () => {
  it("accepts a complete environment", () => {
    const env = parseEnv({ ...VALID, RESEND_API_KEY: "re_123", NODE_ENV: "production" });
    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(env.RESEND_API_KEY).toBe("re_123");
    expect(env.NODE_ENV).toBe("production");
  });

  it("defaults NODE_ENV to development and allows a missing Resend key", () => {
    const env = parseEnv(VALID);
    expect(env.NODE_ENV).toBe("development");
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("names every missing or invalid variable without showing values", () => {
    const run = () => parseEnv({ ...VALID, DATABASE_URL: "not a url", BETTER_AUTH_SECRET: "short", GOOGLE_CLIENT_ID: undefined });
    expect(run).toThrow("DATABASE_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID");
    expect(run).not.toThrow("short");
  });

  it("rejects empty Google credentials", () => {
    expect(() => parseEnv({ ...VALID, GOOGLE_CLIENT_SECRET: "" })).toThrow("GOOGLE_CLIENT_SECRET");
  });
});

describe("EMAIL_VERIFICATION_ENABLED", () => {
  it("is on when missing", () => {
    expect(parseEnv(VALID).EMAIL_VERIFICATION_ENABLED).toBe(true);
  });

  it.each(["true", "TRUE", "False", "0", "off", ""])("is on for anything but exactly false (%j)", (value) => {
    expect(parseEnv({ ...VALID, EMAIL_VERIFICATION_ENABLED: value }).EMAIL_VERIFICATION_ENABLED).toBe(true);
  });

  it("is off only when exactly false", () => {
    expect(parseEnv({ ...VALID, EMAIL_VERIFICATION_ENABLED: "false" }).EMAIL_VERIFICATION_ENABLED).toBe(false);
  });
});
