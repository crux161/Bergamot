# Proteus — Unified Desktop Client

> Named for the Greek sea-god of change and adaptability.
> Proteus shifts to meet the user — a fluid interface across all of Bergamot.

**Language**: TypeScript | **Framework**: Electron 32 + React 18 | **UI Kit**: Semi Design (@douyinfe/semi-ui)

## Architecture

| Layer | File | Description |
|-------|------|-------------|
| Electron Main | `src/main/main.ts` | macOS `hiddenInset` titlebar, `.icns` icon, context-isolated renderer |
| Theme | `src/renderer/styles/theme.ts` | 25 Japanese traditional colors mapped to semantic UI tokens |
| Fonts | `src/renderer/styles/fonts.scss` | HarmonyOS Sans (Thin → Black) from `resources/` |
| Global CSS | `src/renderer/styles/global.scss` | Semi Design CSS variable overrides, scrollbars, drag region |
| Layout | `src/renderer/styles/layout.scss` | Discord-style 4-panel grid (server rail / channels / chat / members) |
| Components | `src/renderer/components/` | ServerList, ChannelList, ChatView, MessageInput, MemberList, LoginScreen |
| API Client | `src/renderer/services/api.ts` | Full Janus REST client (auth, servers, channels) |
| Socket | `src/renderer/services/socket.ts` | Phoenix Channel client for Hermes (join, message, typing) |
| Build | `webpack.main.js`, `webpack.renderer.js` | Dual webpack configs (main process + renderer) |

## Color Palette (Japanese Traditional)

| Role | Color | Hex |
|------|-------|-----|
| App chrome | 藍海松茶 Aimirucha | `#2E372E` |
| Server rail | 鉄色 Tetsu-iro | `#2B3733` |
| Channel sidebar | 虫襖 Mushi'ao | `#2D4436` |
| Chat area | 御召茶 Omeshicha | `#354E4B` |
| Primary accent | 若竹色 Wakatake-iro | `#6B9362` |
| Body text | 白緑 Byakuroku | `#A5BA93` |

## Running

```bash
cd Proteus
npm install
npm run dev     # webpack dev server on :3000
npm run start   # launch Electron (in another terminal)
```

## Build

```bash
npm run build        # webpack production build
npm run package      # electron-builder (macOS .dmg)
```

## Environment

Proteus expects Janus on `http://localhost:8000` and Hermes on `ws://localhost:4000/socket/websocket`. These are configured in `src/renderer/services/api.ts` and `socket.ts`.
