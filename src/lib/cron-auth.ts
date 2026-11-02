import { createHash, timingSafeEqual } from "node:crypto";

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Without a configured secret,
// nothing is accepted. Both sides are hashed first so the compare is constant-time even
// when the lengths differ.
export function isCronAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || !header) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
