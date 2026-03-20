import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/i18n/locales/en/translation.json";
import zhCN from "@/i18n/locales/zh-CN/translation.json";
import zhTW from "@/i18n/locales/zh-TW/translation.json";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  detectInitialLanguage,
  getDateTimeLocale,
  normalizeLanguageTag,
} from "@/i18n/config";

const resources = {
  en: { translation: en },
  "zh-CN": { translation: zhCN },
  "zh-TW": { translation: zhTW },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: {
    escapeValue: false,
  },
});

function syncLanguage(language: string) {
  const normalized = normalizeLanguageTag(language);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  }

  if (typeof document !== "undefined") {
    document.documentElement.lang = normalized;
  }
}

syncLanguage(i18n.resolvedLanguage ?? i18n.language);

i18n.on("languageChanged", (language) => {
  syncLanguage(language);
});

export function formatDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat(
    getDateTimeLocale(i18n.resolvedLanguage ?? i18n.language),
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

export function formatDate(value: string | number | Date) {
  return new Intl.DateTimeFormat(
    getDateTimeLocale(i18n.resolvedLanguage ?? i18n.language),
    {
      dateStyle: "medium",
    },
  ).format(new Date(value));
}

export { i18n };
