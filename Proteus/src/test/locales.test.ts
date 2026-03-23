import { describe, it, expect } from "vitest";
import { t, getLocale, getAvailableLocales } from "../renderer/locales/index";

describe("locale system", () => {
  it("returns the key string for a known key", () => {
    expect(t("app.name")).toBe("Bergamot");
  });

  it("interpolates parameters", () => {
    expect(t("chat.typing", { user: "Athena" })).toBe("Athena is typing...");
  });

  it("falls back to the key when not found", () => {
    expect(t("nonexistent.key" as any)).toBe("nonexistent.key");
  });

  it("defaults to English", () => {
    expect(getLocale()).toBe("en");
  });

  it("lists available locales", () => {
    const locales = getAvailableLocales();
    expect(locales).toContainEqual({ code: "en", name: "English" });
  });
});
