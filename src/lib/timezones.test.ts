import { describe, expect, it } from "vitest";
import { isValidTimezone, timezoneLabel, TIMEZONES } from "./timezones";

describe("isValidTimezone", () => {
  it("accepts zones from the runtime list", () => {
    expect(TIMEZONES.length).toBeGreaterThan(100);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Pacific/Auckland")).toBe(true);
  });

  it("accepts real zone names missing from the list", () => {
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
  });

  it.each(["", "Mars/Base", "+05:00", "-08:00", "America/New York", "../etc/passwd"])(
    "rejects %j",
    (zone) => {
      expect(isValidTimezone(zone)).toBe(false);
    },
  );
});

describe("timezoneLabel", () => {
  it("replaces underscores with spaces", () => {
    expect(timezoneLabel("America/Port_of_Spain")).toBe("America/Port of Spain");
  });
});
