/**
 * Bergamot Theme — derived from traditional Japanese color names.
 *
 * The palette moves from deep forest floors (backgrounds) through
 * bamboo greens (accents) to pale celadon (text/highlights).
 */

export const bergamot = {
  // ── Backgrounds (darkest → lightest) ──
  bgDeepest: "#2E372E", // 藍海松茶 Aimirucha — app chrome, title bar
  bgDark: "#2B3733", // 鉄色 Tetsu-iro — server list sidebar
  bgBase: "#2D4436", // 虫襖 Mushi'ao — channel list panel
  bgElevated: "#354E4B", // 御召茶 Omeshicha — chat area
  bgSurface: "#3A403B", // 錆鉄御納戸 Sabitetsuonando — cards, modals
  bgHover: "#3D4035", // 御納戸茶 Onandocha — hover states

  // ── Accent / Primary ──
  primary: "#6B9362", // 若竹色 Wakatake-iro — buttons, active states
  primaryHover: "#407A52", // 緑青 Rokushō — button hover
  primaryActive: "#2A603B", // 緑 Midori — button pressed
  primarySubtle: "#3D5D42", // 木賊色 Tokusa-iro — subtle accent bg

  // ── Text ──
  textPrimary: "#A5BA93", // 白緑 Byakuroku — main text
  textSecondary: "#819C8B", // 青磁色 Seiji-iro — secondary text
  textMuted: "#749F8D", // 水浅葱 Mizu'asagi — muted / timestamps
  textDisabled: "#656255", // 利休鼠 Rikyūnezumi — disabled text

  // ── Borders & Dividers ──
  border: "#3A403B", // 錆鉄御納戸 Sabitetsuonando
  borderSubtle: "#374231", // 千歳緑 Chitosemidori
  divider: "#3D4035", // 御納戸茶 Onandocha

  // ── Status / Semantic ──
  online: "#6B9362", // 若竹色 Wakatake-iro
  idle: "#8C9C76", // 薄青 Usu'ao
  dnd: "#898A74", // 錆青磁 Sabiseiji
  offline: "#5A6457", // 沈香茶 Tonocha

  // ── Special ──
  scrollbarThumb: "#5E644F", // 老竹色 Oitake-iro
  scrollbarTrack: "#2E372E", // Aimirucha
  selection: "#224634", // びろうど Birōdo
  mention: "#006442", // 青竹色 Aotake-iro
  mentionBg: "#203838", // 高麗納戸 Kōrainando
} as const;

export type BergamotTheme = typeof bergamot;
