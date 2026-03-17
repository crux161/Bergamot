#!/usr/bin/env node
/**
 * Generates static manifests and copies theme/game assets for the web build.
 *
 * Run after `vite build` or before `vite dev` to populate public/ with:
 *   public/themes/manifest.json   – list of available theme CSS filenames
 *   public/themes/*.css            – copies of each theme file
 *   public/games/manifest.json    – aggregated game entries with web-relative URLs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const THEMES_SRC = path.join(ROOT, "resources", "Custom-Theming");
const GAMES_SRC = path.join(ROOT, "public", "games");
const PUBLIC_THEMES = path.join(ROOT, "public", "themes");

// ── Themes ──

function buildThemeManifest() {
  if (!fs.existsSync(THEMES_SRC)) {
    console.warn("[manifests] No Custom-Theming directory found, skipping themes.");
    return;
  }

  fs.mkdirSync(PUBLIC_THEMES, { recursive: true });

  const cssFiles = fs
    .readdirSync(THEMES_SRC)
    .filter((f) => f.endsWith(".css"));

  // Copy each theme CSS to public/themes/
  for (const file of cssFiles) {
    fs.copyFileSync(path.join(THEMES_SRC, file), path.join(PUBLIC_THEMES, file));
  }

  // Write manifest
  fs.writeFileSync(
    path.join(PUBLIC_THEMES, "manifest.json"),
    JSON.stringify(cssFiles, null, 2) + "\n"
  );

  console.log(`[manifests] Wrote ${cssFiles.length} themes to public/themes/`);
}

// ── Games ──

function buildGameManifest() {
  if (!fs.existsSync(GAMES_SRC)) {
    console.warn("[manifests] No public/games directory found, skipping games.");
    return;
  }

  const entries = [];
  const gameDirs = fs
    .readdirSync(GAMES_SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dir of gameDirs) {
    const manifestPath = path.join(GAMES_SRC, dir.name, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    entries.push({
      ...manifest,
      url: `/games/${dir.name}/${manifest.entry || "index.html"}`,
    });
  }

  fs.writeFileSync(
    path.join(GAMES_SRC, "manifest.json"),
    JSON.stringify(entries, null, 2) + "\n"
  );

  console.log(`[manifests] Wrote ${entries.length} game entries to public/games/manifest.json`);
}

// ── Run ──

buildThemeManifest();
buildGameManifest();
