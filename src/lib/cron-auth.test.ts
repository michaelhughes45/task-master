import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron-auth";

const SECRET = "s3cret-value-long-enough";

describe("isCronAuthorized", () => {
  it("accepts the exact bearer token", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it.each([
    ["no header", null],
    ["empty header", ""],
    ["the secret without Bearer", SECRET],
    ["another scheme", `Basic ${SECRET}`],
    ["a wrong secret", "Bearer nope"],
    ["a longer secret", `Bearer ${SECRET}x`],
    ["a prefix of the secret", `Bearer ${SECRET.slice(0, -1)}`],
    ["lowercase bearer", `bearer ${SECRET}`],
  ])("rejects %s", (_, header) => {
    expect(isCronAuthorized(header, SECRET)).toBe(false);
  });

  it.each([undefined, ""])("rejects everything when no secret is configured (%j)", (secret) => {
    expect(isCronAuthorized("Bearer ", secret)).toBe(false);
    expect(isCronAuthorized("Bearer undefined", secret)).toBe(false);
  });
});
