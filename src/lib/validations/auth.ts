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

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(100, "Use 100 characters or fewer"),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
