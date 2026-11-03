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

describe("push and cron variables", () => {
  it("are optional", () => {
    const env = parseEnv(VALID);
    expect(env.VAPID_PRIVATE_KEY).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it("treat empty values as unset", () => {
    const env = parseEnv({
      ...VALID,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
      VAPID_PRIVATE_KEY: "",
      VAPID_SUBJECT: "",
      CRON_SECRET: "",
    });
    expect(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY).toBeUndefined();
    expect(env.VAPID_SUBJECT).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
  });

  it("accept a mailto: or https: subject and a long cron secret", () => {
    const env = parseEnv({ ...VALID, VAPID_SUBJECT: "mailto:me@example.com", CRON_SECRET: "x".repeat(32) });
    expect(env.VAPID_SUBJECT).toBe("mailto:me@example.com");
    expect(parseEnv({ ...VALID, VAPID_SUBJECT: "https://example.com" }).VAPID_SUBJECT).toBe("https://example.com");
  });

  it("reject a bad subject or a short cron secret", () => {
    expect(() => parseEnv({ ...VALID, VAPID_SUBJECT: "me@example.com" })).toThrow("VAPID_SUBJECT");
    expect(() => parseEnv({ ...VALID, CRON_SECRET: "short" })).toThrow("CRON_SECRET");
  });

  it("treats APP_URL as optional but rejects an invalid one", () => {
    expect(parseEnv(VALID).APP_URL).toBeUndefined();
    expect(parseEnv({ ...VALID, APP_URL: "" }).APP_URL).toBeUndefined();
    expect(parseEnv({ ...VALID, APP_URL: "https://example.vercel.app" }).APP_URL).toBe("https://example.vercel.app");
    expect(() => parseEnv({ ...VALID, APP_URL: "example.vercel.app" })).toThrow("APP_URL");
  });
});
