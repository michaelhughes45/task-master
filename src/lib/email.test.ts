import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: {} }));

const { renderLinkEmail } = await import("./email");

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
