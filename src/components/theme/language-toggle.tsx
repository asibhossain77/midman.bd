"use client";

import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-context";

/**
 * Bangla / English switcher. Shows the language you can switch TO:
 * "English" while in Bangla, "বাংলা" while in English. Preference
 * persists in a cookie + localStorage (cookie mb_lang).
 */
export function LanguageToggle({ withIcon = true }: { withIcon?: boolean }) {
  const { lang, toggle, dict } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 gap-1.5 px-2.5 font-medium sm:px-3"
      aria-label={dict.controls.language}
      title={dict.controls.language}
      onClick={toggle}
    >
      {withIcon && (
        <Languages
          className="hidden size-4 sm:inline-block"
          aria-hidden="true"
        />
      )}
      <span lang={lang === "en" ? "bn" : "en"}>
        {lang === "en" ? dict.controls.toBangla : dict.controls.toEnglish}
      </span>
    </Button>
  );
}
