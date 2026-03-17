declare module "*.scss" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.ttf" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.icns" {
  const src: string;
  export default src;
}

// ── Go WASM runtime (provided by wasm_exec.js) ──
declare class Go {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
  exit(code: number): void;
}

interface Window {
  bergamot?: {
    platform: string;
    versions: {
      electron: string;
      node: string;
      chrome: string;
    };
    getAvailableThemes: () => Promise<string[]>;
    getThemeCss: (filename: string) => Promise<string>;
    getThemesPath: () => Promise<string>;
    openThemesFolder: () => Promise<void>;
    onThemesChanged: (listener: (payload: { filename: string | null; themes: string[] }) => void) => () => void;

    // Games
    listGames: () => Promise<
      Array<{
        id: string;
        name: string;
        icon: string;
        url: string;
        type: "wasm" | "iframe";
        version: string;
        description?: string;
        cover?: string;
        color?: string;
        gamepadMapping?: {
          buttons?: Record<number, string>;
          axes?: Record<number, [string, string]>;
        };
      }>
    >;
  };
}
