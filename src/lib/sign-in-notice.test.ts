import { describe, expect, it } from "vitest";
import { signInNotice } from "./sign-in-notice";

describe("signInNotice", () => {
  it("returns null with no params", () => {
    expect(signInNotice({})).toBeNull();
  });

  it("confirms a password reset", () => {
    expect(signInNotice({ reset: "1" })).toEqual({
      tone: "success",
      message: "Password updated. Sign in with your new password.",
    });
  });

  it("confirms a verified email", () => {
    expect(signInNotice({ verified: "1" })).toEqual({
      tone: "success",
      message: "Email verified. Sign in to continue.",
    });
  });

  it("ignores values other than 1", () => {
    expect(signInNotice({ reset: "yes", verified: "true" })).toBeNull();
  });

  it.each(["TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND"])(
    "explains a failed verification link (%s) even with verified=1",
    (error) => {
      const notice = signInNotice({ error, verified: "1" });
      expect(notice?.tone).toBe("error");
      expect(notice?.message).toMatch(/verification link/);
    },
  );

  it("falls back to the Google sign-in messages for other errors", () => {
    expect(signInNotice({ error: "access_denied" })).toEqual({
      tone: "error",
      message: "Google sign-in was cancelled.",
    });
  });
});
