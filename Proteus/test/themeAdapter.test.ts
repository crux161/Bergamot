import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCompiledThemeCss,
  compileThemeContract,
  compileThemeTokens,
  extractThemeVariables,
} from "../src/renderer/theme/themeAdapter";

const resourcesDir = path.resolve(__dirname, "..", "..", "resources", "Custom-Theming");

async function loadThemeFile(filename: string): Promise<string> {
  return readFile(path.join(resourcesDir, filename), "utf-8");
}

test("default theme provides a complete dark token contract", async () => {
  const defaultCss = await loadThemeFile("ProteusDefault.theme.css");
  const tokens = compileThemeTokens(defaultCss, null, "dark");

  assert.equal(tokens["bg-0"], "#1e1f22");
  assert.equal(tokens["bg-2"], "#313338");
  assert.equal(tokens["accent"], "#6b9362");
  assert.equal(tokens["status-danger"], "#f23f43");
});

test("default theme provides semantic UI tokens", async () => {
  const defaultCss = await loadThemeFile("ProteusDefault.theme.css");
  const contract = compileThemeContract(defaultCss, null, "dark");

  assert.equal(contract.ui["radius-card"], "28px");
  assert.equal(contract.ui["radius-control"], "18px");
  assert.equal(contract.ui["density-scale"], "1");
});

test("DarkMatter variables override the Proteus dark baseline", async () => {
  const [defaultCss, darkMatterCss] = await Promise.all([
    loadThemeFile("ProteusDefault.theme.css"),
    loadThemeFile("DarkMatter.theme.css"),
  ]);

  const tokens = compileThemeTokens(defaultCss, darkMatterCss, "dark");

  assert.equal(tokens["bg-0"], "#0c0e12");
  assert.equal(tokens["bg-1"], "#101218");
  assert.equal(tokens["bg-2"], "#161921");
  assert.equal(tokens["accent"], "rgb(37, 172, 232)");
  assert.equal(tokens["accent-hover"], "rgb(29, 101, 134)");
});

test("ClearVision light mode maps theme-specific text and surface variables", async () => {
  const [defaultCss, clearVisionCss] = await Promise.all([
    loadThemeFile("ProteusDefault.theme.css"),
    loadThemeFile("ClearVision-V7.css"),
  ]);

  const tokens = compileThemeTokens(defaultCss, clearVisionCss, "light");

  assert.equal(tokens["accent"], "#2780e6");
  assert.equal(tokens["text-0"], "#36363c");
  assert.equal(tokens["text-2"], "#75757e");
  assert.equal(tokens["bg-0"], "rgba(252, 252, 252, 0.3)");
  assert.equal(tokens["bg-4"], "rgba(0, 0, 0, 0.3)");
});

test("DiscordPlus dark mode is converted into Proteus surfaces and accents", async () => {
  const [defaultCss, discordPlusCss] = await Promise.all([
    loadThemeFile("ProteusDefault.theme.css"),
    loadThemeFile("DiscordPlus.theme.css"),
  ]);

  const tokens = compileThemeTokens(defaultCss, discordPlusCss, "dark");

  assert.match(tokens["accent"], /^hsl\(320 60% 31%\)$/);
  assert.match(tokens["bg-0"], /^hsla\(320 16% 10% \/ 0\.8\)$/);
  assert.match(tokens["text-0"], /^hsl\(210 12% 94%\)$/);
});

test("AMOLED-Cord dark mode resolves midnight surfaces into Proteus tokens", async () => {
  const [defaultCss, amoledCss] = await Promise.all([
    loadThemeFile("ProteusDefault.theme.css"),
    loadThemeFile("amoled-cord.theme.css"),
  ]);

  const tokens = compileThemeTokens(defaultCss, amoledCss, "dark");

  assert.match(tokens["bg-0"], /color-mix\([\s\S]*#050608 100%[\s\S]*#000000 0%[\s\S]*\)/);
  assert.match(tokens["bg-1"], /color-mix\([\s\S]*#0c0e12 100%[\s\S]*#000000 0%[\s\S]*\)/);
  assert.match(tokens["bg-2"], /color-mix\([\s\S]*#0e1013 100%[\s\S]*#000000 0%[\s\S]*\)/);
  assert.equal(tokens["bg-3"], "#171b20");
  assert.equal(tokens["hover"], "rgba(255, 255, 255, 0.08)");
  assert.match(tokens["scrollbar-thumb"], /color-mix\([\s\S]*#2a2d31 100%[\s\S]*#000000 0%[\s\S]*\)/);
});

test("CreArts import-only theme falls back to the built-in family palette", async () => {
  const [defaultCss, creartsCss] = await Promise.all([
    loadThemeFile("ProteusDefault.theme.css"),
    loadThemeFile("crearts.theme.css"),
  ]);

  const tokens = compileThemeTokens(defaultCss, creartsCss, "dark");

  assert.equal(tokens["bg-0"], "#17181c");
  assert.equal(tokens["bg-1"], "#1e2025");
  assert.equal(tokens["bg-2"], "#242830");
  assert.equal(tokens["accent"], "#5865f2");
  assert.equal(tokens["link"], "#6d7aff");
  assert.equal(tokens["selected"], "rgba(88, 101, 242, 0.18)");
});

test("Proteus Douyin dark mode exposes bundled palette and UI semantics", async () => {
  const [defaultCss, douyinCss] = await Promise.all([
    loadThemeFile("ProteusDefault.theme.css"),
    loadThemeFile("ProteusDouyin.theme.css"),
  ]);

  const contract = compileThemeContract(defaultCss, douyinCss, "dark");

  assert.equal(contract.colors["bg-0"], "#050505");
  assert.equal(contract.colors["accent"], "#fe2c55");
  assert.equal(contract.colors["link"], "#25f4ee");
  assert.equal(contract.ui["radius-card"], "12px");
  assert.equal(contract.ui["density-scale"], "0.92");
});

test("Proteus Douyin light mode resolves the bundled light palette", async () => {
  const [defaultCss, douyinCss] = await Promise.all([
    loadThemeFile("ProteusDefault.theme.css"),
    loadThemeFile("ProteusDouyin.theme.css"),
  ]);

  const tokens = compileThemeTokens(defaultCss, douyinCss, "light");

  assert.equal(tokens["bg-2"], "#ffffff");
  assert.equal(tokens["bg-0"], "#f1f1f1");
  assert.equal(tokens["text-0"], "#1c1c1c");
  assert.equal(tokens["accent"], "#fe2c55");
});

test("variable extraction resolves nested var() references", () => {
  const css = `
    :root {
      --accent: 20, 40, 60;
      --brand-experiment: rgb(var(--accent));
      --background-primary: var(--surface, #123456);
    }
    .theme-dark {
      --surface: #0f1720;
      --text-normal: var(--brand-experiment);
    }
  `;

  const variables = extractThemeVariables(css, "dark");
  assert.equal(variables["--brand-experiment"], "rgb(20, 40, 60)");
  assert.equal(variables["--background-primary"], "#0f1720");
  assert.equal(variables["--text-normal"], "rgb(20, 40, 60)");
});

test("compiled CSS emits Proteus runtime variables", async () => {
  const [defaultCss, frostedGlassCss] = await Promise.all([
    loadThemeFile("ProteusDefault.theme.css"),
    loadThemeFile("FrostedGlass.theme.css"),
  ]);

  const compiledCss = buildCompiledThemeCss({
    baseTheme: "dark",
    defaultCss,
    customCss: frostedGlassCss,
  });

  assert.match(compiledCss, /--proteus-accent:\s*rgb\(103,58,183\);/);
  assert.match(compiledCss, /--proteus-link:\s*#00b0f4;/);
  assert.match(compiledCss, /--proteus-scrollbar-thumb:\s*rgba\(255,255,255,0\.05\);/);
});

test("compiled CSS includes Proteus UI semantic variables", async () => {
  const [defaultCss, douyinCss] = await Promise.all([
    loadThemeFile("ProteusDefault.theme.css"),
    loadThemeFile("ProteusDouyin.theme.css"),
  ]);

  const compiledCss = buildCompiledThemeCss({
    baseTheme: "dark",
    defaultCss,
    customCss: douyinCss,
  });

  assert.match(compiledCss, /--proteus-ui-radius-card:\s*12px;/);
  assert.match(compiledCss, /--proteus-ui-density-scale:\s*0\.92;/);
  assert.match(compiledCss, /--proteus-ui-sidebar-width:\s*280px;/);
});
