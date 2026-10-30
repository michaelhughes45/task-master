// The IANA zones this runtime knows about, for the Settings picker.
export const TIMEZONES: readonly string[] = Intl.supportedValuesOf("timeZone");

const KNOWN = new Set(TIMEZONES);

// Zone names only: letters, digits, "_", "+", "-" in "/"-separated parts. Rules out
// offset strings like "+05:00", which Intl accepts but aren't IANA zones.
const ZONE_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

// A browser can report a zone the server's list leaves out (e.g. "UTC", or "Asia/Kolkata"
// when the list has the older "Asia/Calcutta"), so anything Intl accepts by name is valid too.
export function isValidTimezone(timezone: string) {
  if (KNOWN.has(timezone)) return true;
  if (!ZONE_NAME.test(timezone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// "America/New_York" -> "America/New York"
export function timezoneLabel(timezone: string) {
  return timezone.replaceAll("_", " ");
}
