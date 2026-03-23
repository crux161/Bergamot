import en from "./en.json";

export type LocaleKey = keyof typeof en;

const LOCALES: Record<string, Record<string, string>> = {
  en,
};

let currentLocale = "en";

export function setLocale(locale: string) {
  if (LOCALES[locale]) {
    currentLocale = locale;
    localStorage.setItem("bergamot_locale", locale);
  }
}

export function getLocale(): string {
  return currentLocale;
}

export function t(key: LocaleKey, params?: Record<string, string | number>): string {
  const strings = LOCALES[currentLocale] || LOCALES.en;
  let value = strings[key] || en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }
  return value;
}

export function getAvailableLocales(): { code: string; name: string }[] {
  return [
    { code: "en", name: "English" },
    { code: "ja", name: "日本語" },
  ];
}

// Initialize from localStorage
const stored = typeof localStorage !== "undefined" && typeof localStorage.getItem === "function" ? localStorage.getItem("bergamot_locale") : null;
if (stored && LOCALES[stored]) {
  currentLocale = stored;
}
