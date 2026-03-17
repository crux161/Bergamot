import { Toast } from "@douyinfe/semi-ui";
import {
  buildCompiledThemeCss,
  compileThemeContract,
} from "./themeAdapter";
import type { BaseTheme, ProteusThemeContract } from "./themeAdapter";

export type {
  BaseTheme,
  ProteusThemeContract,
  ProteusTokenRecord,
  ProteusUiTokenRecord,
} from "./themeAdapter";

export interface ThemeChangePayload {
  filename: string | null;
  themes: string[];
}

export interface ThemeRuntimeState {
  activeTheme: string | null;
  baseTheme: BaseTheme;
  compiledCss: string | null;
  themes: string[];
}

export const DEFAULT_THEME_FILENAME = "ProteusDefault.theme.css";

const STYLE_ELEMENT_ID = "proteus-runtime-theme";
const THEME_NAME_KEY = "bergamot_selected_theme";
const COMPILED_THEME_CSS_KEY = "bergamot_compiled_theme_css";
const LEGACY_THEME_CSS_KEY = "bergamot_theme_css";
const BASE_THEME_KEY = "bergamot_base_theme";

const catalogListeners = new Set<(themes: string[]) => void>();
const stateListeners = new Set<(state: ThemeRuntimeState) => void>();

let availableThemes: string[] = [];
let initialized = false;
let defaultThemeCssCache: string | null = null;
let stopWatchingThemes: (() => void) | null = null;
const previewThemeCache = new Map<string, ProteusThemeContract>();

function emitCatalog(): void {
  for (const listener of catalogListeners) {
    listener([...availableThemes]);
  }
}

function emitState(): void {
  const snapshot = getThemeRuntimeState();
  for (const listener of stateListeners) {
    listener(snapshot);
  }
}

export function hasThemeBridge(): boolean {
  return typeof window.bergamot?.getAvailableThemes === "function"
    && typeof window.bergamot?.getThemeCss === "function";
}

function normalizeThemeList(themes: string[]): string[] {
  return themes
    .filter((theme) => theme.endsWith(".css") && theme !== DEFAULT_THEME_FILENAME)
    .sort((left, right) => left.localeCompare(right));
}

export function getStoredBaseTheme(): BaseTheme {
  return localStorage.getItem(BASE_THEME_KEY) === "light" ? "light" : "dark";
}

function getStoredThemeName(): string | null {
  const stored = localStorage.getItem(THEME_NAME_KEY);
  return stored && stored !== DEFAULT_THEME_FILENAME ? stored : null;
}

function persistThemeName(themeName: string | null): void {
  if (themeName) {
    localStorage.setItem(THEME_NAME_KEY, themeName);
  } else {
    localStorage.removeItem(THEME_NAME_KEY);
  }
}

function injectCompiledThemeCss(css: string | null): void {
  let styleElement = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;

  if (!css) {
    styleElement?.remove();
    return;
  }

  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = css;
}

export function applyBaseThemeClass(theme: BaseTheme): void {
  const root = document.documentElement;
  const body = document.body;

  ["theme-dark", "theme-light"].forEach((className) => {
    root.classList.remove(className);
    body.classList.remove(className);
  });

  root.classList.add(`theme-${theme}`);
  body.classList.add(`theme-${theme}`);
  localStorage.setItem(BASE_THEME_KEY, theme);
}

export function restoreThemeSnapshot(): void {
  applyBaseThemeClass(getStoredBaseTheme());

  const cachedCss = localStorage.getItem(COMPILED_THEME_CSS_KEY);
  if (cachedCss) {
    injectCompiledThemeCss(cachedCss);
  }
}

async function loadDefaultThemeCss(): Promise<string> {
  if (defaultThemeCssCache !== null) return defaultThemeCssCache;
  if (!hasThemeBridge()) return "";

  defaultThemeCssCache = await window.bergamot!.getThemeCss(DEFAULT_THEME_FILENAME).catch(() => "");
  return defaultThemeCssCache ?? "";
}

async function compileThemeCss(themeName: string | null, baseTheme: BaseTheme): Promise<string> {
  const defaultCss = await loadDefaultThemeCss();
  const customCss = themeName ? await window.bergamot!.getThemeCss(themeName) : null;

  if (!defaultCss) {
    throw new Error(`Default theme "${DEFAULT_THEME_FILENAME}" could not be loaded.`);
  }

  return buildCompiledThemeCss({
    baseTheme,
    defaultCss,
    customCss,
  });
}

function getPreviewCacheKey(themeName: string | null, baseTheme: BaseTheme): string {
  return `${baseTheme}:${themeName ?? "__default__"}`;
}

export async function getThemePreviewContract(
  themeName: string | null,
  baseTheme: BaseTheme,
): Promise<ProteusThemeContract> {
  const cacheKey = getPreviewCacheKey(themeName, baseTheme);
  const cachedContract = previewThemeCache.get(cacheKey);
  if (cachedContract) {
    return cachedContract;
  }

  const defaultCss = await loadDefaultThemeCss();
  const customCss = themeName ? await window.bergamot!.getThemeCss(themeName) : null;

  if (!defaultCss) {
    throw new Error(`Default theme "${DEFAULT_THEME_FILENAME}" could not be loaded.`);
  }

  const previewContract = compileThemeContract(defaultCss, customCss, baseTheme);
  previewThemeCache.set(cacheKey, previewContract);
  return previewContract;
}

async function applyCurrentTheme(options?: {
  silentMissingThemeFallback?: boolean;
  changedFilename?: string | null;
}): Promise<void> {
  const activeTheme = getStoredThemeName();
  const baseTheme = getStoredBaseTheme();

  try {
    const compiledCss = await compileThemeCss(activeTheme, baseTheme);
    injectCompiledThemeCss(compiledCss);
    localStorage.setItem(COMPILED_THEME_CSS_KEY, compiledCss);
    localStorage.removeItem(LEGACY_THEME_CSS_KEY);
    emitState();
  } catch (error) {
    if (activeTheme) {
      persistThemeName(null);
      const fallbackCss = await compileThemeCss(null, baseTheme);
      injectCompiledThemeCss(fallbackCss);
      localStorage.setItem(COMPILED_THEME_CSS_KEY, fallbackCss);
      emitState();

      if (!options?.silentMissingThemeFallback) {
        Toast.warning({
          content: `Theme "${activeTheme}" is no longer available. Reverted to the Proteus default theme.`,
          duration: 3,
        });
      }
      return;
    }

    const changedDetail = options?.changedFilename ? ` (${options.changedFilename})` : "";
    console.error(`[Proteus] Failed to compile theme${changedDetail}:`, error);
    Toast.error({
      content: "Failed to compile the current theme. Proteus kept the last applied colors.",
      duration: 3,
    });
  }
}

export async function refreshThemeCatalog(): Promise<string[]> {
  if (!hasThemeBridge()) {
    availableThemes = [];
    emitCatalog();
    emitState();
    return [];
  }

  const themes = await window.bergamot!.getAvailableThemes();
  availableThemes = normalizeThemeList(themes);
  emitCatalog();
  emitState();
  return [...availableThemes];
}

export function getAvailableThemes(): string[] {
  return [...availableThemes];
}

export function getThemeRuntimeState(): ThemeRuntimeState {
  return {
    activeTheme: getStoredThemeName(),
    baseTheme: getStoredBaseTheme(),
    compiledCss: localStorage.getItem(COMPILED_THEME_CSS_KEY),
    themes: [...availableThemes],
  };
}

export async function selectTheme(themeName: string | null): Promise<void> {
  persistThemeName(themeName);
  await applyCurrentTheme();
}

export async function setBaseTheme(theme: BaseTheme): Promise<void> {
  applyBaseThemeClass(theme);
  await applyCurrentTheme({ silentMissingThemeFallback: true });
}

function handleThemeChange(payload: ThemeChangePayload): void {
  previewThemeCache.clear();

  if (payload.filename === DEFAULT_THEME_FILENAME) {
    defaultThemeCssCache = null;
  }

  availableThemes = normalizeThemeList(payload.themes);
  emitCatalog();

  const activeTheme = getStoredThemeName();
  if (activeTheme && !availableThemes.includes(activeTheme)) {
    void applyCurrentTheme({
      silentMissingThemeFallback: false,
      changedFilename: payload.filename,
    });
    return;
  }

  if (
    payload.filename === null
    || payload.filename === DEFAULT_THEME_FILENAME
    || payload.filename === activeTheme
  ) {
    void applyCurrentTheme({
      silentMissingThemeFallback: true,
      changedFilename: payload.filename,
    });
  } else {
    emitState();
  }
}

export function subscribeThemeCatalog(listener: (themes: string[]) => void): () => void {
  catalogListeners.add(listener);
  listener([...availableThemes]);
  return () => {
    catalogListeners.delete(listener);
  };
}

export function subscribeThemeState(listener: (state: ThemeRuntimeState) => void): () => void {
  stateListeners.add(listener);
  listener(getThemeRuntimeState());
  return () => {
    stateListeners.delete(listener);
  };
}

export async function initializeThemeRuntime(): Promise<void> {
  if (initialized) return;
  initialized = true;

  applyBaseThemeClass(getStoredBaseTheme());
  await refreshThemeCatalog();
  await applyCurrentTheme({ silentMissingThemeFallback: true });

  if (hasThemeBridge() && typeof window.bergamot!.onThemesChanged === "function") {
    stopWatchingThemes = window.bergamot!.onThemesChanged(handleThemeChange);
  }
}

export function disposeThemeRuntime(): void {
  stopWatchingThemes?.();
  stopWatchingThemes = null;
  initialized = false;
  previewThemeCache.clear();
}
