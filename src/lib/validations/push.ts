import { z } from "zod";

// Push services hand out https endpoints; anything else is refused before it's stored.
export const pushEndpointSchema = z.url({ protocol: /^https$/ }).max(2048);

// The shape of PushSubscription.toJSON() in the browser.
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(64),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
