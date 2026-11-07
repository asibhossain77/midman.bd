/**
 * Midman.bd — Transactional email.
 *
 * EMAIL PROVIDER: Resend (https://resend.com) over its simple REST API
 * when RESEND_API_KEY + EMAIL_FROM are configured. Without them the
 * sender runs in CONSOLE mode: emails are logged server-side and the
 * app degrades gracefully (the API responses expose the action links
 * ONLY when NODE_ENV !== "production", so local tests can complete the
 * verification / reset flows without an SMTP account).
 *
 * This is the only place that knows about email — swapping to SES,
 * Postmark or SMTP later touches this file alone.
 */

import "server-only";

export interface OutgoingEmail {
  to: string;
  subject: string;
  /** Bangla + English friendly body (plain text — escrow links only). */
  text: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Resend-compatible endpoint. Overridable so tests can point the SAME
 * production code path at a local catcher (and self-hosters at
 * compatible APIs) — never used to bypass auth logic.
 */
function resendApiUrl(): string {
  return process.env.RESEND_API_URL?.trim() || "https://api.resend.com/emails";
}

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  if (!isEmailConfigured()) {
    console.info(
      `[email:console] to=${email.to} subject="${email.subject}"\n${email.text}`
    );
    return;
  }

  const res = await fetch(resendApiUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!res || !res.ok) {
    // Never fail the user flow because the mail provider hiccuped —
    // the token can be re-sent. Log for the operator.
    console.error("[email] send failed", res?.status);
  }
}

/* --------------------------- Templates ------------------------------ */

export function verificationEmail(name: string, verifyUrl: string): OutgoingEmail {
  return {
    to: "", // filled by the caller with the account email
    subject: "Verify your Midman.bd email / আপনার Midman.bd ইমেইল যাচাই করুন",
    text:
      `Hi ${name},\n\n` +
      `Confirm your email address to secure your Midman.bd escrow account:\n${verifyUrl}\n\n` +
      `The link expires in 24 hours. If you didn't create an account, ignore this email.\n\n` +
      `প্রিয় ${name},\n\n` +
      `আপনার Midman.bd এস্ক্রো অ্যাকাউন্ট সুরক্ষিত করতে ইমেইল নিশ্চিত করুন:\n${verifyUrl}\n\n` +
      `লিংকটি ২৪ ঘণ্টার জন্য বৈধ। আপনি অ্যাকাউন্ট খুলে থাকলে এই ইমেইল উপেক্ষা করুন।\n`,
  };
}

export function passwordResetEmail(resetUrl: string): OutgoingEmail {
  return {
    to: "",
    subject: "Reset your Midman.bd password / আপনার Midman.bd পাসওয়ার্ড রিসেট করুন",
    text:
      `A password reset was requested for your Midman.bd account.\n` +
      `Reset link (valid for 1 hour):\n${resetUrl}\n\n` +
      `If this wasn't you, your account is still safe — just ignore this email.\n\n` +
      `আপনার Midman.bd অ্যাকাউন্টের জন্য পাসওয়ার্ড রিসেটের অনুরোধ করা হয়েছে।\n` +
      `রিসেট লিংক (১ ঘণ্টার জন্য বৈধ):\n${resetUrl}\n\n` +
      `এটি আপনি না করে থাকলে অ্যাকাউন্ট নিরাপদ — এই ইমেইল উপেক্ষা করুন।\n`,
  };
}
