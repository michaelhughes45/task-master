import { describe, expect, it } from "vitest";
import { isPushServiceEndpoint, pushEndpointSchema, pushSubscriptionSchema } from "./push";

describe("isPushServiceEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/QGx2abc",
    "https://FCM.googleapis.com/fcm/send/abc",
  ])("accepts %s", (endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(true);
  });

  it.each([
    ["another host", "https://attacker.example.com/hook"],
    ["http", "http://fcm.googleapis.com/fcm/send/abc"],
    ["a lookalike prefix", "https://evilfcm.googleapis.com/x"],
    ["a lookalike domain suffix", "https://fcm.googleapis.com.attacker.com/x"],
    ["a domain glued to the suffix", "https://evilpush.apple.com/x"],
    ["userinfo before the host", "https://fcm.googleapis.com@attacker.com/x"],
    ["credentials", "https://user:pass@fcm.googleapis.com/x"],
    ["an explicit port", "https://fcm.googleapis.com:8443/x"],
    ["another Google host", "https://www.googleapis.com/x"],
    ["an IP address", "https://169.254.169.254/latest"],
    ["not a URL", "fcm.googleapis.com/fcm/send/abc"],
  ])("rejects %s", (_, endpoint) => {
    expect(isPushServiceEndpoint(endpoint)).toBe(false);
  });
});

describe("push schemas", () => {
  const keys = { p256dh: "BPk3y", auth: "a1b2" };

  it("only accepts subscriptions to a known push service", () => {
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/fcm/send/a", keys }).success).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ endpoint: "https://attacker.example.com/a", keys }).success).toBe(false);
  });

  it("still lets any https endpoint be removed", () => {
    expect(pushEndpointSchema.safeParse("https://attacker.example.com/a").success).toBe(true);
  });
});
