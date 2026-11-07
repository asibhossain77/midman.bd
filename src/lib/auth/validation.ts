/**
 * Midman.bd — Request validation schemas (zod).
 *
 * Every API route parses its body through one of these schemas before
 * touching the database. Role fields DO NOT EXIST here by design — the
 * public API can never grant a role.
 */

import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password";

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(255)
  .email()
  .transform((v) => v.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "password_short").max(PASSWORD_MAX_LENGTH),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "name_short").max(80),
  email: emailSchema,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, "password_short")
    .max(PASSWORD_MAX_LENGTH, "password_long"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, "password_short")
    .max(PASSWORD_MAX_LENGTH, "password_long"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, "password_short")
    .max(PASSWORD_MAX_LENGTH, "password_long"),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "name_short").max(80).optional(),
});

/** Flat { field: error_key } map for the login/register forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
