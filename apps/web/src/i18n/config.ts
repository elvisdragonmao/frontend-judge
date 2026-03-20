export const SUPPORTED_LANGUAGES = ["zh-TW", "zh-CN", "en"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "zh-TW";
export const LANGUAGE_STORAGE_KEY = "app-language";

export function normalizeLanguageTag(language?: string | null): AppLanguage {
  if (!language) {
    return DEFAULT_LANGUAGE;
  }

  const normalized = language.toLowerCase();

  if (
    normalized === "zh-cn" ||
    normalized === "zh-hans" ||
    normalized.startsWith("zh-cn") ||
    normalized.startsWith("zh-hans")
  ) {
    return "zh-CN";
  }

  if (
    normalized === "zh-tw" ||
    normalized === "zh-hant" ||
    normalized === "zh-hk" ||
    normalized.startsWith("zh-tw") ||
    normalized.startsWith("zh-hant") ||
    normalized.startsWith("zh-hk") ||
    normalized.startsWith("zh")
  ) {
    return "zh-TW";
  }

  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  return DEFAULT_LANGUAGE;
}

export function getStoredLanguage(): AppLanguage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored ? normalizeLanguageTag(stored) : null;
}

export function detectInitialLanguage(): AppLanguage {
  const stored = getStoredLanguage();

  if (stored) {
    return stored;
  }

  if (typeof navigator !== "undefined") {
    return normalizeLanguageTag(navigator.language);
  }

  return DEFAULT_LANGUAGE;
}

export function getDateTimeLocale(language: string): string {
  return normalizeLanguageTag(language);
}
