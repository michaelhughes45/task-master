import { describe, expect, it } from "vitest";
import { userInitials } from "./user-initials";

describe("userInitials", () => {
  it("uses the first and last word", () => {
    expect(userInitials("Michael James Hughes", "m@example.com")).toBe("MH");
  });

  it("uses one letter for a single name", () => {
    expect(userInitials("  sam ", "s@example.com")).toBe("S");
  });

  it("falls back to the email when the name is blank", () => {
    expect(userInitials("   ", "alex@example.com")).toBe("A");
  });
});
