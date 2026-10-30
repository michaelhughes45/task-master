import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isEmailVerificationEnabled, renderLinkEmail } = await import("./email");

describe("isEmailVerificationEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is on when set to true", () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "true");
    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it("is on when missing", () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", undefined);
    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it.each(["TRUE", "False", "0", "off", ""])("is on for anything but exactly false (%j)", (value) => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", value);
    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it("is off only when exactly false", () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "false");
    expect(isEmailVerificationEnabled()).toBe(false);
  });
});

describe("renderLinkEmail", () => {
  const content = {
    intro: "Confirm your email.",
    linkLabel: "Verify email",
    url: "http://localhost:3000/api/auth/verify-email?token=abc&callbackURL=%2Fsign-in",
    expiry: "This link expires in 1 hour.",
  };

  it("puts the sentence, link and expiry in the text version", () => {
    const { text } = renderLinkEmail(content);
    expect(text).toContain(content.intro);
    expect(text).toContain(content.url);
    expect(text).toContain(content.expiry);
  });

  it("escapes the link in the HTML version", () => {
    const { html } = renderLinkEmail(content);
    expect(html).toContain('href="http://localhost:3000/api/auth/verify-email?token=abc&amp;callbackURL=%2Fsign-in"');
    expect(html).not.toContain("token=abc&callbackURL");
  });
});
