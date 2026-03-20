import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, normalizeLanguageTag } from "@/i18n/config";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const value = normalizeLanguageTag(i18n.resolvedLanguage ?? i18n.language);

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{t("layout.language.label")}</span>
      <select
        aria-label={t("layout.language.label")}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none"
        value={value}
        onChange={(event) => {
          void i18n.changeLanguage(event.target.value);
        }}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {t(`languages.${language}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
