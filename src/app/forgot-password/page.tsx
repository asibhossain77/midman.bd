import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell testId="forgot-card">
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
