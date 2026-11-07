import { SiteLogo } from "@/components/branding/site-logo";

/**
 * Shared centered card shell for the auth pages (login, register,
 * forgot, reset, verify). Standard background, no site chrome — the
 * same pattern as Midman Verify's auth pages.
 */
export function AuthPageShell({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <a
              href="/"
              aria-label="Midman.bd home"
              className="rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <SiteLogo imageClassName="h-10 sm:h-11" />
            </a>
          </div>
          <div
            data-testid={testId}
            className="rounded-xl border bg-card p-6 sm:p-8"
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Centered icon chip + title + subtitle above auth forms. */
export function AuthCardHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 text-center">
      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
        {icon}
      </div>
      <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

/** Standard Google "G" mark for the OAuth button. */
export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-4"} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
