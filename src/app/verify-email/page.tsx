import type { Metadata } from "next";

import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { VerifyEmail } from "@/components/auth/verify-email";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthPageShell testId="verify-card">
      <VerifyEmail token={params.token ?? null} />
    </AuthPageShell>
  );
}
