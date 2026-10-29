import { describe, expect, it } from "vitest";
import { DEFAULT_CALLBACK_URL, safeCallbackUrl } from "./safe-callback-url";

describe("safeCallbackUrl", () => {
  it.each([
    ["/today", "/today"],
    ["/calendar?view=week&date=2026-11-02", "/calendar?view=week&date=2026-11-02"],
    ["/review/2026-10-26#notes", "/review/2026-10-26#notes"],
  ])("keeps the same-origin path %s", (input, expected) => {
    expect(safeCallbackUrl(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["today"],
    ["https://evil.example/today"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["/\\/evil.example"],
    ["/today\\..\\evil"],
    ["/\tevil"],
    ["javascript:alert(1)"],
  ])("falls back to the default for %s", (input) => {
    expect(safeCallbackUrl(input)).toBe(DEFAULT_CALLBACK_URL);
  });
});
