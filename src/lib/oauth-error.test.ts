import { describe, expect, it } from "vitest";
import { oauthErrorMessage } from "./oauth-error";

describe("oauthErrorMessage", () => {
  it.each([[null], [undefined], [""]])("returns null when there is no error (%s)", (code) => {
    expect(oauthErrorMessage(code)).toBeNull();
  });

  it("explains a cancelled Google sign-in", () => {
    expect(oauthErrorMessage("access_denied")).toBe("Google sign-in was cancelled.");
  });

  it("points an existing password account back to the password form", () => {
    expect(oauthErrorMessage("account_not_linked")).toMatch(/email and password/);
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(oauthErrorMessage("invalid_code")).toBe("Couldn't sign you in with Google. Try again.");
    expect(oauthErrorMessage("<script>")).toBe("Couldn't sign you in with Google. Try again.");
  });
});
