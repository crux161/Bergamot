/**
 * Bergamot Theme — derived from traditional Japanese color names.
 *
 * Backgrounds use neutral charcoal/slate tones for depth,
 * green is reserved for accents and interactive elements,
 * and text uses warm off-whites and cool grays for readability.
 */

export const bergamot = {
  // ── Backgrounds (darkest → lightest) ── neutral slate/charcoal
  bgDeepest: "#1E1F22", // 墨 Sumi — app chrome, deepest
  bgDark: "#232428", // 鉄紺 Tetsukon — server list sidebar
  bgBase: "#2B2D31", // 漆黒 Shikkoku — channel list panel
  bgElevated: "#313338", // 鳩羽鼠 Hatobanezu — chat area
  bgSurface: "#383A40", // 消炭 Keshizumi — cards, modals, inputs
  bgHover: "#404249", // 鼠色 Nezumiiro — hover states

  // ── Accent / Primary ── the Bergamot green
  primary: "#6B9362", // 若竹色 Wakatake-iro — buttons, active states
  primaryHover: "#5A8352", // 緑青 Rokushō — button hover
  primaryActive: "#4A7343", // 緑 Midori — button pressed
  primarySubtle: "#3D5D42", // 木賊色 Tokusa-iro — subtle accent bg

  // ── Text ── warm off-whites and neutral grays
  textPrimary: "#E0E1E5", // 白鼠 Shironezumi — main text
  textSecondary: "#B5BAC1", // 銀鼠 Ginnezumi — secondary text
  textMuted: "#80848E", // 鉛色 Namariiro — muted / timestamps
  textDisabled: "#5C5E66", // 利休鼠 Rikyūnezumi — disabled text

  // ── Borders & Dividers ──
  border: "#3F4147", // 錆鉄 Sabitetsu
  borderSubtle: "#35373C", // 鉄御納戸 Tetsuonando
  divider: "#404249", // 鼠色 Nezumiiro

  // ── Status / Semantic ──
  online: "#23A55A", // brighter green for visibility
  idle: "#F0B232", // amber
  dnd: "#F23F43", // red
  offline: "#80848E", // 鉛色 Namariiro

  // ── Special ──
  scrollbarThumb: "#4E5058", // 灰色 Haiiro
  scrollbarTrack: "#2B2D31", // Shikkoku
  selection: "#2E4A3E", // びろうど Birōdo — green-tinted selection
  mention: "#3C4533", // subtle green mention
  mentionBg: "#2F3424", // mention background
} as const;

export type BergamotTheme = typeof bergamot;
