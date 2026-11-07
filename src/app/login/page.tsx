import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/auth/login-form";
import { isGoogleOAuthConfigured } from "@/lib/auth/google";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <AuthPageShell testId="login-card">
      <LoginForm googleEnabled={isGoogleOAuthConfigured()} />
    </AuthPageShell>
  );
}
