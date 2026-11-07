"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

import { LANG_COOKIE, dictionaries, type Dictionary, type Language } from "./dictionary";

interface LanguageContextValue {
  lang: Language;
  dict: Dictionary;
  setLang: (lang: Language) => void;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/* ------------------------------------------------------------------ */
/* Cookie as the external store                                        */
/* ------------------------------------------------------------------ */

/**
 * Midman.bd is Bangla-first: when no explicit preference is stored the
 * platform renders Bangla (the escrow audience is Bangladesh-first).
 * English is one tap away and persists like Verify's switcher.
 */
const DEFAULT_LANGUAGE: Language = "bn";

function readCookieLang(): Language {
  if (typeof document === "undefined") return DEFAULT_LANGUAGE;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${LANG_COOKIE}=`));
  return match?.split("=")[1] === "en" ? "en" : DEFAULT_LANGUAGE;
}

function persist(lang: Language) {
  // 1 year; path-wide so every route reads it. Not HttpOnly — it is a
  // pure UI preference with no security value.
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  try {
    localStorage.setItem(LANG_COOKIE, lang);
  } catch {
    /* storage may be unavailable — cookie remains the source of truth */
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Cross-tab sync: persist() also writes localStorage, so other tabs
  // receive a `storage` event.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const getSnapshot = (): Language => readCookieLang();
const getServerSnapshot = (): Language => DEFAULT_LANGUAGE;

/* ------------------------------------------------------------------ */

/**
 * Client language provider for the Bangla / English switcher.
 *
 * - The cookie is the single source of truth, read through
 *   useSyncExternalStore: SSR always renders the Bangla default
 *   (matching the server HTML), the client restores the stored
 *   preference without a setState-in-effect, and language changes
 *   re-render every consumer.
 * - <html lang> is kept in sync so fonts, Bengali line-height rules and
 *   screen readers follow the active language.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    persist(next);
    listeners.forEach((listener) => listener());
  }, []);

  const toggle = useCallback(() => {
    persist(readCookieLang() === "bn" ? "en" : "bn");
    listeners.forEach((listener) => listener());
  }, []);

  return (
    <LanguageContext.Provider
      value={{ lang, dict: dictionaries[lang], setLang, toggle }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside <LanguageProvider>.");
  }
  return ctx;
}
