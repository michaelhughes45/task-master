import "server-only";
import { z } from "zod";

// Only the variables the app reads today. Add the push and cron ones with their specs.
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
