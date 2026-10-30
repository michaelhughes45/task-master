import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use 128 characters or fewer");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(128, "Use 128 characters or fewer"),
});

const passwordsMatch = {
  check: (data: { password: string; confirmPassword: string }) =>
    data.password === data.confirmPassword,
  params: { message: "Passwords don't match", path: ["confirmPassword"] },
};

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(100, "Use 100 characters or fewer"),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch.check, passwordsMatch.params);

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine(passwordsMatch.check, passwordsMatch.params);

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;