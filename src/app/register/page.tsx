import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { isGoogleOAuthConfigured } from "@/lib/auth/google";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <AuthPageShell testId="register-card">
      <RegisterForm googleEnabled={isGoogleOAuthConfigured()} />
    </AuthPageShell>
  );
}
