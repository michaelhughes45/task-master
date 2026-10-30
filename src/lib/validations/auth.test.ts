import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./auth";

const validSignUp = {
  name: "Sam",
  email: "sam@example.com",
  password: "correct horse",
  confirmPassword: "correct horse",
};

function fieldErrors<T>(result: z.ZodSafeParseResult<T>): Partial<Record<keyof T, string[]>> {
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

describe("signInSchema", () => {
  it("accepts a valid email and password, normalising the email", () => {
    const result = signInSchema.safeParse({ email: "  Sam@Example.com ", password: "x" });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("sam@example.com");
  });

  it("rejects an invalid email and an empty password", () => {
    const errors = fieldErrors(signInSchema.safeParse({ email: "nope", password: "" }));
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });
});

describe("signUpSchema", () => {
  it("accepts valid input and trims the name", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, name: "  Sam  " });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Sam");
  });

  it("requires a name", () => {
    expect(fieldErrors(signUpSchema.safeParse({ ...validSignUp, name: "   " })).name).toBeDefined();
  });

  it.each([
    ["7 characters", "a".repeat(7), false],
    ["8 characters", "a".repeat(8), true],
    ["128 characters", "a".repeat(128), true],
    ["129 characters", "a".repeat(129), false],
  ])("password of %s valid: %s", (_label, password, valid) => {
    const result = signUpSchema.safeParse({ ...validSignUp, password, confirmPassword: password });
    expect(result.success).toBe(valid);
  });

  it("reports mismatched passwords on confirmPassword", () => {
    const errors = fieldErrors(
      signUpSchema.safeParse({ ...validSignUp, confirmPassword: "something else" }),
    );
    expect(errors.confirmPassword).toEqual(["Passwords don't match"]);
  });
});

describe("forgotPasswordSchema", () => {
  it("normalises the email", () => {
    expect(forgotPasswordSchema.safeParse({ email: " Sam@Example.com" }).data?.email).toBe(
      "sam@example.com",
    );
  });

  it("rejects an invalid email", () => {
    expect(fieldErrors(forgotPasswordSchema.safeParse({ email: "nope" })).email).toBeDefined();
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords of 8+ characters", () => {
    const result = resetPasswordSchema.safeParse({ password: "a".repeat(8), confirmPassword: "a".repeat(8) });
    expect(result.success).toBe(true);
  });

  it("rejects a short password", () => {
    const errors = fieldErrors(resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }));
    expect(errors.password).toBeDefined();
  });

  it("reports mismatched passwords on confirmPassword", () => {
    const errors = fieldErrors(
      resetPasswordSchema.safeParse({ password: "a".repeat(8), confirmPassword: "b".repeat(8) }),
    );
    expect(errors.confirmPassword).toEqual(["Passwords don't match"]);
  });
});

describe("changePasswordSchema", () => {
  const valid = { currentPassword: "old-password", password: "a".repeat(8), confirmPassword: "a".repeat(8) };

  it("accepts a current password and a matching new one", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("requires the current password", () => {
    const errors = fieldErrors(changePasswordSchema.safeParse({ ...valid, currentPassword: "" }));
    expect(errors.currentPassword).toEqual(["Enter your current password"]);
  });

  it("rejects a short new password", () => {
    const errors = fieldErrors(
      changePasswordSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }),
    );
    expect(errors.password).toBeDefined();
  });

  it("reports mismatched new passwords on confirmPassword", () => {
    const errors = fieldErrors(changePasswordSchema.safeParse({ ...valid, confirmPassword: "b".repeat(8) }));
    expect(errors.confirmPassword).toEqual(["Passwords don't match"]);
  });
});
