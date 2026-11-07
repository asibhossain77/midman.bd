"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-context";

const emptySubscribe = () => () => {};
/** false during SSR / hydration, true afterwards — no setState-in-effect. */
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Light / Dark mode toggle. Renders a stable placeholder until mounted
 * to avoid hydration mismatch (the theme is resolved client-side by
 * next-themes from storage or the OS preference).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const { dict } = useLanguage();

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-9"
      aria-label={dict.controls.theme}
      title={dict.controls.theme}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted ? (
        resolvedTheme === "dark" ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )
      ) : (
        <span className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
