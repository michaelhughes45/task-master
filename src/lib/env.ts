import "server-only";
import { z } from "zod";

// An empty value (e.g. "KEY=" copied from .env.example) counts as unset.
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // Optional so a missing key only fails sends, not the whole app
  RESEND_API_KEY: z.string().optional(),
  // On unless exactly "false", so a typo never switches verification off
  EMAIL_VERIFICATION_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  // Optional so a missing key only stops push, not the whole app
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional(z.string()),
  VAPID_PRIVATE_KEY: optional(z.string()),
  VAPID_SUBJECT: optional(z.string().regex(/^(mailto:|https:\/\/)/)),
  // Without it the cron route rejects every request
  CRON_SECRET: optional(z.string().min(16)),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Names only: values may be secrets
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid or missing environment variables: ${names.join(", ")}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
