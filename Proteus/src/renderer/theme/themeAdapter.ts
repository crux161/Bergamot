export type BaseTheme = "dark" | "light";

export const PROTEUS_TOKEN_NAMES = [
  "bg-0",
  "bg-1",
  "bg-2",
  "bg-3",
  "bg-4",
  "text-0",
  "text-1",
  "text-2",
  "text-3",
  "accent",
  "accent-hover",
  "accent-active",
  "accent-subtle",
  "link",
  "border",
  "border-subtle",
  "hover",
  "selected",
  "active",
  "status-positive",
  "status-warning",
  "status-danger",
  "status-offline",
  "scrollbar-thumb",
  "scrollbar-track",
  "selection",
  "mention",
  "mention-bg",
] as const;

export const PROTEUS_UI_TOKEN_NAMES = [
  "radius-card",
  "radius-control",
  "radius-pill",
  "shadow-card",
  "shadow-float",
  "shell-gap",
  "panel-gap",
  "content-gap",
  "header-height",
  "sidebar-width",
  "right-rail-width",
  "density-scale",
] as const;

export type ProteusTokenName = (typeof PROTEUS_TOKEN_NAMES)[number];
export type ProteusTokenRecord = Record<ProteusTokenName, string>;
export type ProteusUiTokenName = (typeof PROTEUS_UI_TOKEN_NAMES)[number];
export type ProteusUiTokenRecord = Record<ProteusUiTokenName, string>;

export interface ProteusThemeContract {
  colors: ProteusTokenRecord;
  ui: ProteusUiTokenRecord;
}

interface CssBlock {
  selector: string;
  declarations: Record<string, string>;
  index: number;
}

interface BuildCompiledThemeCssInput {
  baseTheme: BaseTheme;
  defaultCss: string;
  customCss?: string | null;
}

type ThemeFamily = "amoled-cord" | "crearts" | null;

const CSS_BLOCK_RE = /([^{}]+)\{([^{}]*)\}/g;
const CSS_VAR_RE = /(--[\w-]+)\s*:\s*([^;]+);/g;

function detectThemeFamily(css: string): ThemeFamily {
  const normalized = css.toLowerCase();

  if (
    normalized.includes("@name amoled-cord")
    || normalized.includes("luckfire.github.io/amoled-cord")
    || normalized.includes("github.com/luckfire/amoled-cord")
  ) {
    return "amoled-cord";
  }

  if (
    normalized.includes("@name crearts")
    || normalized.includes("crearts-discord")
    || normalized.includes("crearts-community.github.io/crearts-discord")
  ) {
    return "crearts";
  }

  return null;
}

function buildAmoledCordSeedVariables(baseTheme: BaseTheme): Record<string, string> {
  if (baseTheme === "light") {
    return {};
  }

  return {
    "--opacity-4": "rgba(255, 255, 255, 0.04)",
    "--opacity-8": "rgba(255, 255, 255, 0.08)",
    "--opacity-12": "rgba(255, 255, 255, 0.12)",
    "--opacity-16": "rgba(255, 255, 255, 0.16)",
    "--opacity-20": "rgba(255, 255, 255, 0.20)",
    "--neutral-88": "#0e1013",
    "--neutral-80": "#2a2d31",
    "--neutral-79": "#23262b",
    "--background-base-lowest": "#050608",
    "--background-base-low": "#0c0e12",
    "--background-base-lower": "#12151a",
    "--background-surface-high": "#171b20",
    "--border-subtle": "rgba(255, 255, 255, 0.08)",
    "--border-muted": "rgba(255, 255, 255, 0.12)",
    "--app-frame-border": "rgba(255, 255, 255, 0.08)",
    "--theme-base-color": "#000000",
    "--theme-base-color-hsl": "0 0% 0%",
    "--theme-base-color-amount": "0%",
    "--black-hsl": "0 0% 0%",
  };
}

function buildCreArtsSeedVariables(baseTheme: BaseTheme): Record<string, string> {
  if (baseTheme === "light") {
    return {
      "--background-secondary-alt": "#e8ebf2",
      "--background-tertiary": "#e8ebf2",
      "--background-secondary": "#f3f5f9",
      "--background-primary": "#ffffff",
      "--background-floating": "#f7f9fc",
      "--channeltextarea-background": "#f7f9fc",
      "--header-primary": "#171b25",
      "--header-secondary": "#313848",
      "--text-normal": "#313848",
      "--interactive-normal": "#313848",
      "--text-muted": "#667186",
      "--interactive-muted": "#8a92a3",
      "--normal-text": "#171b25",
      "--muted-text": "#667186",
      "--brand-experiment": "#5865f2",
      "--brand-experiment-560": "#4752c4",
      "--hover-color": "#4752c4",
      "--text-link": "#4752c4",
      "--background-modifier-accent": "rgba(31, 35, 53, 0.12)",
      "--background-modifier-hover": "rgba(88, 101, 242, 0.08)",
      "--background-modifier-selected": "rgba(88, 101, 242, 0.14)",
      "--background-modifier-active": "rgba(88, 101, 242, 0.18)",
      "--status-positive": "#23a55a",
      "--status-warning": "#f0b232",
      "--status-danger": "#f23f43",
      "--status-offline": "#80848e",
      "--scrollbar-auto-thumb": "rgba(49, 56, 72, 0.18)",
      "--scrollbar-auto-track": "rgba(49, 56, 72, 0.06)",
      "--selection": "rgba(88, 101, 242, 0.18)",
      "--mention": "#b7791f",
      "--mention-bg": "rgba(240, 178, 50, 0.16)",
    };
  }

  return {
    "--background-secondary-alt": "#17181c",
    "--background-tertiary": "#17181c",
    "--background-secondary": "#1e2025",
    "--background-primary": "#242830",
    "--background-floating": "#2c313a",
    "--channeltextarea-background": "#2c313a",
    "--header-primary": "#f1f3f8",
    "--header-secondary": "#d2d8e2",
    "--text-normal": "#d2d8e2",
    "--interactive-normal": "#d2d8e2",
    "--text-muted": "#9aa3b5",
    "--interactive-muted": "#707887",
    "--normal-text": "#f1f3f8",
    "--muted-text": "#9aa3b5",
    "--brand-experiment": "#5865f2",
    "--brand-experiment-560": "#4752c4",
    "--hover-color": "#4752c4",
    "--text-link": "#6d7aff",
    "--background-modifier-accent": "rgba(255, 255, 255, 0.08)",
    "--background-modifier-hover": "rgba(255, 255, 255, 0.06)",
    "--background-modifier-selected": "rgba(88, 101, 242, 0.18)",
    "--background-modifier-active": "rgba(88, 101, 242, 0.24)",
    "--status-positive": "#23a55a",
    "--status-warning": "#f0b232",
    "--status-danger": "#f23f43",
    "--status-offline": "#80848e",
    "--scrollbar-auto-thumb": "rgba(255, 255, 255, 0.14)",
    "--scrollbar-auto-track": "rgba(0, 0, 0, 0.22)",
    "--selection": "rgba(88, 101, 242, 0.28)",
    "--mention": "#f0b232",
    "--mention-bg": "rgba(240, 178, 50, 0.16)",
  };
}

function buildThemeSeedVariables(css: string, baseTheme: BaseTheme): Record<string, string> {
  switch (detectThemeFamily(css)) {
    case "amoled-cord":
      return buildAmoledCordSeedVariables(baseTheme);
    case "crearts":
      return buildCreArtsSeedVariables(baseTheme);
    default:
      return {};
  }
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of input) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    }

    if (char === delimiter && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = "";
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

function expandIsSelectors(selector: string): string[] {
  const match = selector.match(/:is\(([^()]*)\)/);
  if (!match) return [selector.trim()];

  const [fullMatch, inner] = match;
  const before = selector.slice(0, match.index);
  const after = selector.slice((match.index ?? 0) + fullMatch.length);
  const expanded: string[] = [];

  for (const option of splitTopLevel(inner, ",")) {
    for (const next of expandIsSelectors(`${before}${option}${after}`)) {
      expanded.push(next.trim());
    }
  }

  return expanded;
}

function extractCssBlocks(css: string): CssBlock[] {
  const blocks: CssBlock[] = [];
  const cleanedCss = stripComments(css);
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = CSS_BLOCK_RE.exec(cleanedCss))) {
    const selector = match[1]?.trim();
    const body = match[2] ?? "";

    if (!selector) continue;

    const declarations: Record<string, string> = {};
    let varMatch: RegExpExecArray | null;
    CSS_VAR_RE.lastIndex = 0;

    while ((varMatch = CSS_VAR_RE.exec(body))) {
      const name = varMatch[1]?.trim();
      const value = varMatch[2]?.trim();
      if (name && value) declarations[name] = value.replace(/\s*!important\s*$/i, "").trim();
    }

    if (Object.keys(declarations).length > 0) {
      blocks.push({ selector, declarations, index: index++ });
    }
  }

  return blocks;
}

function getLastThemeClass(selector: string): string | null {
  const themeClasses = selector.match(/\.theme-(light|dark|darker|midnight)\b/g);
  if (!themeClasses || themeClasses.length === 0) return null;
  return themeClasses[themeClasses.length - 1];
}

function getSelectorPriority(selector: string, baseTheme: BaseTheme): number {
  const expandedSelectors = expandIsSelectors(selector);
  let priority = -1;

  for (const expanded of expandedSelectors) {
    const lastThemeClass = getLastThemeClass(expanded);

    if (!lastThemeClass) {
      if (expanded.includes(":root")) {
        priority = Math.max(priority, 0);
      }
      continue;
    }

    if (baseTheme === "light") {
      if (lastThemeClass === ".theme-light") {
        priority = Math.max(priority, 3);
      }
      continue;
    }

    if (lastThemeClass === ".theme-midnight") {
      priority = Math.max(priority, 1);
    } else if (lastThemeClass === ".theme-darker") {
      priority = Math.max(priority, 2);
    } else if (lastThemeClass === ".theme-dark") {
      priority = Math.max(priority, 3);
    }
  }

  return priority;
}

function extractResolvedVariables(css: string, baseTheme: BaseTheme): Record<string, string> {
  const matchingBlocks = extractCssBlocks(css)
    .map((block) => ({
      ...block,
      priority: getSelectorPriority(block.selector, baseTheme),
    }))
    .filter((block) => block.priority >= 0)
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority;
      return left.index - right.index;
    });

  const rawVariables: Record<string, string> = {
    ...buildThemeSeedVariables(css, baseTheme),
  };
  for (const block of matchingBlocks) {
    Object.assign(rawVariables, block.declarations);
  }

  return resolveVariableMap(rawVariables);
}

function resolveVariableMap(rawVariables: Record<string, string>): Record<string, string> {
  const cache: Record<string, string> = {};
  const resolving = new Set<string>();

  const resolveVariable = (name: string): string => {
    if (cache[name] !== undefined) return cache[name];
    if (!rawVariables[name]) return "";
    if (resolving.has(name)) return rawVariables[name];

    resolving.add(name);
    const resolved = resolveValue(rawVariables[name], resolveVariable);
    resolving.delete(name);
    cache[name] = resolved;
    return resolved;
  };

  for (const name of Object.keys(rawVariables)) {
    resolveVariable(name);
  }

  return cache;
}

function resolveValue(
  input: string,
  resolveVariable: (name: string) => string,
): string {
  let value = input.trim();
  let replaced = true;
  let iterations = 0;

  while (replaced && iterations < 20) {
    replaced = false;
    iterations += 1;

    value = value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_match, varName: string, fallback?: string) => {
      const resolved = resolveVariable(varName);
      if (resolved) {
        replaced = true;
        return resolved;
      }

      if (fallback) {
        replaced = true;
        return resolveValue(fallback, resolveVariable);
      }

      return "";
    });
  }

  return value.trim();
}

function firstDefined(
  variables: Record<string, string>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = variables[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeColor(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim().replace(/\s*!important\s*$/i, "");
  if (!trimmed || /url\(/i.test(trimmed) || trimmed === "none") return undefined;

  if (/^\d+\s*,\s*\d+\s*,\s*\d+$/u.test(trimmed)) {
    return `rgb(${trimmed})`;
  }

  if (/^\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+$/u.test(trimmed)) {
    return `rgba(${trimmed})`;
  }

  if (
    /^(#|rgb\(|rgba\(|hsl\(|hsla\(|oklch\(|lab\(|lch\(|color\(|color-mix\(|transparent$|currentColor$|white$|black$)/iu.test(trimmed)
  ) {
    return trimmed;
  }

  return undefined;
}

function normalizeUiValue(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim().replace(/\s*!important\s*$/i, "");
  if (!trimmed || trimmed === "none") return undefined;
  return trimmed;
}

function shade(color: string, percentage: number, toward: "black" | "white"): string {
  return `color-mix(in srgb, ${color} ${100 - percentage}%, ${toward} ${percentage}%)`;
}

function mix(colorA: string, colorB: string, colorAPercentage: number): string {
  return `color-mix(in srgb, ${colorA} ${colorAPercentage}%, ${colorB} ${100 - colorAPercentage}%)`;
}

function normalizeNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildDiscordPlusColor(
  hue: number | null,
  saturation: number | null,
  lightness: number,
  alpha?: number | null,
): string | undefined {
  if (hue === null) return undefined;
  const sat = clamp(saturation ?? 50, 0, 100);
  const light = clamp(lightness, 0, 100);
  if (alpha !== undefined && alpha !== null) {
    return `hsla(${hue} ${sat}% ${light}% / ${clamp(alpha, 0, 1)})`;
  }
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function mapDiscordPlusTokens(
  variables: Record<string, string>,
  baseTheme: BaseTheme,
): Partial<ProteusTokenRecord> {
  const accentHue = normalizeNumber(variables["--dplus-accent-color-hue"]);
  const accentSaturation = normalizeNumber(variables["--dplus-accent-color-saturation"]);
  const accentLightness = normalizeNumber(variables["--dplus-accent-color-lightness"]);

  const backgroundHue = normalizeNumber(variables["--dplus-background-color-hue"]);
  const backgroundSaturationAmount = normalizeNumber(variables["--dplus-background-color-saturation-amount"]) ?? 1;
  const backgroundLightnessAmount = normalizeNumber(variables["--dplus-background-color-lightness-amount"]) ?? 1;
  const backgroundAlpha = normalizeNumber(variables["--dplus-background-color-alpha"]);

  const foregroundHue = normalizeNumber(variables["--dplus-foreground-color-hue-base"]);
  const foregroundLinkHue = normalizeNumber(variables["--dplus-foreground-color-hue-links"]);
  const foregroundSaturationAmount = normalizeNumber(variables["--dplus-foreground-color-saturation-amount"]) ?? 1;
  const foregroundLightnessAmount = normalizeNumber(variables["--dplus-foreground-color-lightness-amount"]) ?? 1;

  const accent = normalizeColor(
    buildDiscordPlusColor(accentHue, accentSaturation, accentLightness ?? 31),
  );

  const darkBackgroundLevels = [10, 16, 21, 27, 33];
  const lightBackgroundLevels = [90, 95, 99, 94, 88];
  const backgroundLevels = baseTheme === "dark" ? darkBackgroundLevels : lightBackgroundLevels;
  const foregroundLevels = baseTheme === "dark"
    ? [94, 78, 60, 44]
    : [10, 21, 37, 62];

  const backgroundSaturation = clamp(16 * backgroundSaturationAmount, 0, 100);
  const foregroundSaturation = clamp(12 * foregroundSaturationAmount, 0, 100);

  const makeSurface = (level: number) => normalizeColor(
    buildDiscordPlusColor(
      backgroundHue,
      backgroundSaturation,
      level * backgroundLightnessAmount,
      backgroundAlpha,
    ),
  );

  const makeForeground = (level: number, customHue?: number | null) => normalizeColor(
    buildDiscordPlusColor(
      customHue ?? foregroundHue,
      foregroundSaturation,
      level * foregroundLightnessAmount,
    ),
  );

  return {
    ...(accent ? {
      accent,
      "accent-hover": shade(accent, 12, "black"),
      "accent-active": shade(accent, 24, "black"),
      "accent-subtle": mix(accent, baseTheme === "dark" ? "black" : "white", baseTheme === "dark" ? 26 : 16),
    } : {}),
    ...(makeSurface(backgroundLevels[0]) ? { "bg-0": makeSurface(backgroundLevels[0])! } : {}),
    ...(makeSurface(backgroundLevels[1]) ? { "bg-1": makeSurface(backgroundLevels[1])! } : {}),
    ...(makeSurface(backgroundLevels[2]) ? { "bg-2": makeSurface(backgroundLevels[2])! } : {}),
    ...(makeSurface(backgroundLevels[3]) ? { "bg-3": makeSurface(backgroundLevels[3])! } : {}),
    ...(makeSurface(backgroundLevels[4]) ? { "bg-4": makeSurface(backgroundLevels[4])! } : {}),
    ...(makeForeground(foregroundLevels[0]) ? { "text-0": makeForeground(foregroundLevels[0])! } : {}),
    ...(makeForeground(foregroundLevels[1]) ? { "text-1": makeForeground(foregroundLevels[1])! } : {}),
    ...(makeForeground(foregroundLevels[2]) ? { "text-2": makeForeground(foregroundLevels[2])! } : {}),
    ...(makeForeground(foregroundLevels[3]) ? { "text-3": makeForeground(foregroundLevels[3])! } : {}),
    ...(makeForeground(foregroundLevels[1], foregroundLinkHue) ? { link: makeForeground(foregroundLevels[1], foregroundLinkHue)! } : {}),
  };
}

function mapBetterDiscordVariables(
  variables: Record<string, string>,
  baseTheme: BaseTheme,
): Partial<ProteusTokenRecord> {
  const directTokens: Partial<ProteusTokenRecord> = {};

  for (const tokenName of PROTEUS_TOKEN_NAMES) {
    const direct = normalizeColor(variables[`--proteus-${tokenName}`]);
    if (direct) directTokens[tokenName] = direct;
  }

  const discordMapped: Partial<ProteusTokenRecord> = {
    "bg-0": normalizeColor(firstDefined(variables, "--background-tertiary", "--background-secondary-alt", "--input-background")),
    "bg-1": normalizeColor(firstDefined(variables, "--background-secondary", "--background-solid-dark")),
    "bg-2": normalizeColor(firstDefined(variables, "--background-primary", "--background-solid")),
    "bg-3": normalizeColor(firstDefined(variables, "--background-floating", "--channeltextarea-background", "--background-solid")),
    "bg-4": normalizeColor(firstDefined(variables, "--channeltextarea-background", "--background-modifier-selected")),
    "text-0": normalizeColor(firstDefined(variables, "--header-primary", "--normal-text")),
    "text-1": normalizeColor(firstDefined(variables, "--text-normal", "--interactive-normal", "--normal-text")),
    "text-2": normalizeColor(firstDefined(variables, "--text-muted", "--header-secondary", "--muted-text")),
    "text-3": normalizeColor(firstDefined(variables, "--interactive-muted", "--muted-text")),
    accent: normalizeColor(firstDefined(variables, "--brand-experiment", "--main-color")),
    "accent-hover": normalizeColor(firstDefined(variables, "--brand-experiment-560", "--hover-color")),
    "accent-active": normalizeColor(firstDefined(variables, "--hover-color")),
    "accent-subtle": normalizeColor(firstDefined(variables, "--proteus-accent-subtle")),
    link: normalizeColor(firstDefined(variables, "--text-link", "--link-colour")),
    border: normalizeColor(firstDefined(variables, "--background-modifier-accent")),
    "border-subtle": normalizeColor(firstDefined(variables, "--proteus-border-subtle")),
    hover: normalizeColor(firstDefined(variables, "--background-modifier-hover")),
    selected: normalizeColor(firstDefined(variables, "--background-modifier-selected", "--channel-selected-bg")),
    active: normalizeColor(firstDefined(variables, "--background-modifier-active")),
    "status-positive": normalizeColor(firstDefined(variables, "--status-positive", "--success-color", "--online-color")),
    "status-warning": normalizeColor(firstDefined(variables, "--status-warning", "--idle-color")),
    "status-danger": normalizeColor(firstDefined(variables, "--status-danger", "--danger-color", "--dnd-color")),
    "status-offline": normalizeColor(firstDefined(variables, "--status-offline", "--offline-color")),
    "scrollbar-thumb": normalizeColor(firstDefined(variables, "--scrollbar-auto-thumb", "--scrollbar-thin-thumb", "--scrollbar-colour")),
    "scrollbar-track": normalizeColor(firstDefined(variables, "--scrollbar-auto-track")),
    selection: normalizeColor(firstDefined(variables, "--selection")),
    mention: normalizeColor(firstDefined(variables, "--mention")),
    "mention-bg": normalizeColor(firstDefined(variables, "--mention-bg")),
  };

  const clearVisionMapped: Partial<ProteusTokenRecord> = {
    "bg-0": normalizeColor(firstDefined(variables, "--background-shading")) ?? discordMapped["bg-0"],
    "bg-1": normalizeColor(firstDefined(variables, "--card-shading")) ?? discordMapped["bg-1"],
    "bg-2": normalizeColor(firstDefined(variables, "--card-shading")) ?? discordMapped["bg-2"],
    "bg-3": normalizeColor(firstDefined(variables, "--popout-shading", "--modal-shading")) ?? discordMapped["bg-3"],
    "bg-4": normalizeColor(firstDefined(variables, "--input-shading")) ?? discordMapped["bg-4"],
    "text-0": normalizeColor(firstDefined(variables, "--normal-text")) ?? discordMapped["text-0"],
    "text-1": normalizeColor(firstDefined(variables, "--normal-text")) ?? discordMapped["text-1"],
    "text-2": normalizeColor(firstDefined(variables, "--muted-text")) ?? discordMapped["text-2"],
    "text-3": normalizeColor(firstDefined(variables, "--muted-text")) ?? discordMapped["text-3"],
    accent: normalizeColor(firstDefined(variables, "--main-color")) ?? discordMapped.accent,
    "accent-hover": normalizeColor(firstDefined(variables, "--hover-color")) ?? discordMapped["accent-hover"],
    "accent-active": normalizeColor(firstDefined(variables, "--hover-color")) ?? discordMapped["accent-active"],
    link: normalizeColor(firstDefined(variables, "--main-color")) ?? discordMapped.link,
  };

  const darkMatterAccent = normalizeColor(firstDefined(variables, "--accent"));
  const darkMatterAccentAlt = normalizeColor(firstDefined(variables, "--accent-alt"));
  const darkMatterMapped: Partial<ProteusTokenRecord> = {
    "bg-0": normalizeColor(firstDefined(variables, "--background-solid-darker")) ?? discordMapped["bg-0"],
    "bg-1": normalizeColor(firstDefined(variables, "--background-solid-dark")) ?? discordMapped["bg-1"],
    "bg-2": normalizeColor(firstDefined(variables, "--background-solid")) ?? discordMapped["bg-2"],
    "bg-3": normalizeColor(firstDefined(variables, "--background-solid")) ?? discordMapped["bg-3"],
    accent: darkMatterAccent ?? discordMapped.accent,
    "accent-hover": darkMatterAccentAlt ?? discordMapped["accent-hover"],
    "accent-active": darkMatterAccentAlt ?? discordMapped["accent-active"],
    link: darkMatterAccent ?? discordMapped.link,
  };

  const frostedGlassAccent = normalizeColor(firstDefined(variables, "--gradient-primary", "--tint-colour"));
  const frostedGlassAccentAlt = normalizeColor(firstDefined(variables, "--gradient-secondary", "--tint-colour"));
  const frostedGlassMapped: Partial<ProteusTokenRecord> = {
    accent: frostedGlassAccent ?? discordMapped.accent,
    "accent-hover": frostedGlassAccentAlt ?? discordMapped["accent-hover"],
    "accent-active": frostedGlassAccentAlt ?? discordMapped["accent-active"],
    link: normalizeColor(firstDefined(variables, "--link-colour")) ?? discordMapped.link,
    "scrollbar-thumb": normalizeColor(firstDefined(variables, "--scrollbar-colour")) ?? discordMapped["scrollbar-thumb"],
  };

  const isAmoledMappedTheme = [
    "--background-base-lowest",
    "--background-base-low",
    "--background-base-lower",
    "--background-surface-high",
    "--app-frame-border",
  ].some((name) => !!variables[name]);

  const amoledMapped: Partial<ProteusTokenRecord> = isAmoledMappedTheme
    ? {
      "bg-0": normalizeColor(firstDefined(variables, "--modal-background", "--background-base-lowest", "--custom-channel-members-bg")) ?? discordMapped["bg-0"],
      "bg-1": normalizeColor(firstDefined(variables, "--card-background-default", "--background-base-low")) ?? discordMapped["bg-1"],
      "bg-2": normalizeColor(firstDefined(variables, "--background-secondary-alt", "--background-base-low")) ?? discordMapped["bg-2"],
      "bg-3": normalizeColor(firstDefined(variables, "--background-surface-high", "--background-base-lower")) ?? discordMapped["bg-3"],
      "bg-4": normalizeColor(firstDefined(variables, "--background-base-lower", "--background-mod-normal")) ?? discordMapped["bg-4"],
      border: normalizeColor(firstDefined(variables, "--border-muted", "--app-frame-border")) ?? discordMapped.border,
      "border-subtle": normalizeColor(firstDefined(variables, "--border-subtle")) ?? discordMapped["border-subtle"],
      hover: normalizeColor(firstDefined(variables, "--interactive-background-hover", "--message-background-hover")) ?? discordMapped.hover,
      selected: normalizeColor(firstDefined(variables, "--interactive-background-selected")) ?? discordMapped.selected,
      active: normalizeColor(firstDefined(variables, "--interactive-background-active")) ?? discordMapped.active,
      "scrollbar-thumb": normalizeColor(
        firstDefined(variables, "--scrollbar-auto-thumb", "--scrollbar-auto-scrollbar-color-thumb", "--scrollbar-thin-thumb"),
      ) ?? discordMapped["scrollbar-thumb"],
    }
    : {};

  const discordPlusMapped = mapDiscordPlusTokens(variables, baseTheme);

  const compactTokens = (tokens: Partial<ProteusTokenRecord>): Partial<ProteusTokenRecord> => Object.fromEntries(
    Object.entries(tokens).filter((entry) => !!entry[1]),
  ) as Partial<ProteusTokenRecord>;

  const merged: Partial<ProteusTokenRecord> = {
    ...compactTokens(discordMapped),
    ...compactTokens(clearVisionMapped),
    ...compactTokens(darkMatterMapped),
    ...compactTokens(amoledMapped),
    ...compactTokens(discordPlusMapped),
    ...compactTokens(frostedGlassMapped),
    ...compactTokens(directTokens),
  };

  if (!merged["accent-hover"] && merged.accent) {
    merged["accent-hover"] = shade(merged.accent, 12, "black");
  }

  if (!merged["accent-active"] && merged.accent) {
    merged["accent-active"] = shade(merged.accent, 24, "black");
  }

  if (!merged["accent-subtle"] && merged.accent) {
    merged["accent-subtle"] = mix(merged.accent, baseTheme === "dark" ? "black" : "white", baseTheme === "dark" ? 28 : 18);
  }

  if (!merged.link && merged.accent) {
    merged.link = merged.accent;
  }

  if (!merged["border-subtle"] && merged.border && merged["bg-0"]) {
    merged["border-subtle"] = mix(merged.border, merged["bg-0"], 70);
  }

  if (!merged.selection && merged.accent && merged["bg-0"]) {
    merged.selection = mix(merged.accent, merged["bg-0"], baseTheme === "dark" ? 36 : 24);
  }

  if (!merged.mention && merged["accent-subtle"]) {
    merged.mention = merged["accent-subtle"];
  }

  if (!merged["mention-bg"] && merged["accent-subtle"] && merged["bg-0"]) {
    merged["mention-bg"] = mix(merged["accent-subtle"], merged["bg-0"], 50);
  }

  return Object.fromEntries(
    Object.entries(merged).filter((entry): entry is [ProteusTokenName, string] => !!entry[1]),
  );
}

function mapProteusUiVariables(
  variables: Record<string, string>,
): Partial<ProteusUiTokenRecord> {
  const uiTokens: Partial<ProteusUiTokenRecord> = {};

  for (const tokenName of PROTEUS_UI_TOKEN_NAMES) {
    const direct = normalizeUiValue(variables[`--proteus-ui-${tokenName}`]);
    if (direct) uiTokens[tokenName] = direct;
  }

  return uiTokens;
}

function renderCompiledCss(contract: ProteusThemeContract, baseTheme: BaseTheme): string {
  const colorLines = PROTEUS_TOKEN_NAMES.map((tokenName) => `  --proteus-${tokenName}: ${contract.colors[tokenName]};`);
  const uiLines = PROTEUS_UI_TOKEN_NAMES.map((tokenName) => `  --proteus-ui-${tokenName}: ${contract.ui[tokenName]};`);
  // Use :root.theme-{mode} to match or exceed the specificity of the
  // fallback blocks in global.scss (:root.theme-light / :root.theme-dark).
  // Without this, the global.scss light-mode fallback always wins because
  // :root.theme-light (0,1,1) beats a plain :root (0,0,1).
  const selector = `:root.theme-${baseTheme}`;
  return [selector + " {", ...colorLines, ...uiLines, "}"].join("\n");
}

function ensureAllTokens(tokens: Partial<ProteusTokenRecord>): ProteusTokenRecord {
  const missingTokens = PROTEUS_TOKEN_NAMES.filter((tokenName) => !tokens[tokenName]);
  if (missingTokens.length > 0) {
    throw new Error(`Missing Proteus theme tokens: ${missingTokens.join(", ")}`);
  }

  return tokens as ProteusTokenRecord;
}

function ensureAllUiTokens(tokens: Partial<ProteusUiTokenRecord>): ProteusUiTokenRecord {
  const missingTokens = PROTEUS_UI_TOKEN_NAMES.filter((tokenName) => !tokens[tokenName]);
  if (missingTokens.length > 0) {
    throw new Error(`Missing Proteus UI theme tokens: ${missingTokens.join(", ")}`);
  }

  return tokens as ProteusUiTokenRecord;
}

export function compileThemeContract(
  defaultCss: string,
  customCss: string | null | undefined,
  baseTheme: BaseTheme,
): ProteusThemeContract {
  const defaultVariables = extractResolvedVariables(defaultCss, baseTheme);
  const defaultColors = mapBetterDiscordVariables(defaultVariables, baseTheme);
  const defaultUi = mapProteusUiVariables(defaultVariables);

  if (customCss) {
    const customVariables = extractResolvedVariables(customCss, baseTheme);
    const customColors = mapBetterDiscordVariables(customVariables, baseTheme);
    const customUi = mapProteusUiVariables(customVariables);

    return {
      colors: ensureAllTokens({
        ...defaultColors,
        ...customColors,
      }),
      ui: ensureAllUiTokens({
        ...defaultUi,
        ...customUi,
      }),
    };
  }

  return {
    colors: ensureAllTokens(defaultColors),
    ui: ensureAllUiTokens(defaultUi),
  };
}

export function compileThemeTokens(
  defaultCss: string,
  customCss: string | null | undefined,
  baseTheme: BaseTheme,
): ProteusTokenRecord {
  return compileThemeContract(defaultCss, customCss, baseTheme).colors;
}

export function buildCompiledThemeCss({
  baseTheme,
  defaultCss,
  customCss,
}: BuildCompiledThemeCssInput): string {
  return renderCompiledCss(compileThemeContract(defaultCss, customCss, baseTheme), baseTheme);
}

export function extractThemeVariables(css: string, baseTheme: BaseTheme): Record<string, string> {
  return extractResolvedVariables(css, baseTheme);
}
