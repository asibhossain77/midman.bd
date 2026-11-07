/**
 * Midman.bd logo — the Midman family mark with an escrow identity.
 *
 * The brand mark (leaf-green rounded square + dark shield with a green
 * check) mirrors the Midman Verify badge geometry — the two platforms
 * are explicitly one product family. The wordmark is real HTML text
 * (Poppins via the UI font stack) so dark-mode ink swaps are plain
 * Tailwind classes and the Bangla/EN switcher never affects it.
 */

export function SiteLogo({
  className,
  imageClassName,
}: {
  className?: string;
  /** Mark height class, e.g. "h-9". */
  imageClassName?: string;
}) {
  return (
    <span
      className={
        className ?? "inline-flex items-center gap-2.5 whitespace-nowrap"
      }
    >
      <svg
        className={`${imageClassName ?? "h-8"} w-auto`}
        viewBox="0 0 60 60"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="2" y="2" width="56" height="56" rx="14" fill="#88cb34" />
        <path
          d="M30 11 L44.5 17.5 V30 C44.5 39.4 38.6 46.8 30 50 C21.4 46.8 15.5 39.4 15.5 30 V17.5 Z"
          fill="#1a2e10"
          opacity="0.92"
        />
        <path
          d="M23.4 30.2 L28.1 35 L37.1 24.9"
          stroke="#88cb34"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-[19px] font-bold tracking-tight text-foreground">
          Midman<span className="text-primary">.bd</span>
        </span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Escrow
        </span>
      </span>
    </span>
  );
}

/** Compact square mark for the collapsed admin rail / icon slots. */
export function SiteMark({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "size-8"}
      viewBox="0 0 60 60"
      role="img"
      aria-label="Midman.bd"
    >
      <rect x="2" y="2" width="56" height="56" rx="14" fill="#88cb34" />
      <path
        d="M30 11 L44.5 17.5 V30 C44.5 39.4 38.6 46.8 30 50 C21.4 46.8 15.5 39.4 15.5 30 V17.5 Z"
        fill="#1a2e10"
        opacity="0.92"
      />
      <path
        d="M23.4 30.2 L28.1 35 L37.1 24.9"
        stroke="#88cb34"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
